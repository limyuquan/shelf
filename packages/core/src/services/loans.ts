import { addDays, parseDueExpression } from "../domain/due.ts";
import { isClean } from "../domain/loan-state.ts";
import { assertSkillName } from "../domain/skill-name.ts";
import type { EventType, Loan, LoanPolicy, Project, RevisionHash, Skill } from "../domain/types.ts";
import { ShelfError } from "../errors.ts";
import { pathExists, replaceDirectory } from "../library/fs.ts";
import { hashDirectoryIfExists } from "../library/hash.ts";
import { librarySkillPath, revisionPath, snapshotSkill } from "../library/library.ts";
import { readSkillMetadata } from "../library/skill-file.ts";
import { removeSkillCopies, skillCopyPath, writeSkillCopies } from "../projection/materialize.ts";
import { writeTransaction } from "../store/database.ts";
import { recordEvent } from "../store/events.ts";
import {
  closeLoan,
  findActiveLoan,
  insertLoan,
  setLoanDue,
  setLoanRevision,
} from "../store/loans.ts";
import { insertRevision, updateSkillHead } from "../store/skills.ts";
import type { Context } from "./context.ts";
import { inspectBorrowedSkill, inspectLoans, type LoanInspection } from "./inspect.ts";
import { requireSkill } from "./library.ts";
import { requireProject, syncLockfile } from "./project.ts";

export interface BorrowResult {
  readonly skill: string;
  readonly status: "borrowed" | "already-borrowed";
  readonly revision: RevisionHash;
  readonly dueAt: Date;
  readonly targets: readonly string[];
}

/** Borrows skills into the current project. Idempotent: re-borrowing is a no-op. */
export async function borrow(
  ctx: Context,
  names: readonly string[],
  options: { days?: number; policy?: LoanPolicy } = {},
): Promise<BorrowResult[]> {
  if (names.length === 0) throw new ShelfError("INVALID_ARGUMENT", "Name at least one skill");
  const { project } = await requireProject(ctx);
  const days = options.days ?? ctx.config.loanDays;
  assertWithinLoanLimit(ctx, days);

  // Validate everything before touching the project, so a bad name changes nothing.
  const plan: { skill: Skill; existing: Loan | null }[] = [];
  for (const name of new Set(names)) {
    assertSkillName(name);
    const skill = requireSkill(ctx, name);
    const existing = findActiveLoan(ctx.db, project.id, name);
    if (!existing) await assertNoUnmanagedCopies(ctx, project, skill);
    plan.push({ skill, existing });
  }

  const results: BorrowResult[] = [];
  for (const { skill, existing } of plan) {
    if (existing) {
      results.push({ skill: skill.name, status: "already-borrowed", ...pickLoan(existing) });
      continue;
    }
    const targets = ctx.config.targets;
    const now = ctx.clock.now();
    const dueAt = addDays(now, days);
    await writeSkillCopies(
      project.path,
      targets,
      skill.name,
      revisionPath(ctx.paths, skill.latestRevision),
    );
    writeTransaction(ctx.db, () => {
      insertLoan(ctx.db, {
        projectId: project.id,
        skillId: skill.id,
        revision: skill.latestRevision,
        targets,
        policy: options.policy ?? "pinned",
        borrowedAt: now,
        dueAt,
      });
      recordEvent(ctx.db, {
        type: "loan.borrowed",
        actor: ctx.actor,
        at: now,
        projectId: project.id,
        skillId: skill.id,
        detail: { revision: skill.latestRevision, dueAt: dueAt.toISOString() },
      });
      syncLockfile(ctx.db, project);
    });
    results.push({
      skill: skill.name,
      status: "borrowed",
      revision: skill.latestRevision,
      dueAt,
      targets,
    });
  }
  return results;
}

/**
 * Refuses to overwrite skill directories shelf does not manage. A leftover copy that
 * is byte-identical to the revision being borrowed (e.g. from an interrupted borrow)
 * is safe to take over.
 */
async function assertNoUnmanagedCopies(
  ctx: Context,
  project: Project,
  skill: Skill,
): Promise<void> {
  for (const target of ctx.config.targets) {
    const path = skillCopyPath(project.path, target, skill.name);
    const hash = await hashDirectoryIfExists(path);
    if (hash !== null && hash !== skill.latestRevision) {
      throw new ShelfError(
        "CONFLICT",
        `${path} already exists and is not managed by shelf`,
        "Move or delete it first, or import it into the library as a new skill",
      );
    }
  }
}

export interface DueChange {
  readonly skill: string;
  readonly previousDueAt: Date;
  readonly dueAt: Date;
}

/** Extends a loan by `days` from its due date (or from now, if already overdue). */
export async function renew(
  ctx: Context,
  name: string,
  options: { days?: number; reason?: string } = {},
): Promise<DueChange> {
  const days = options.days ?? ctx.config.loanDays;
  return changeDue(ctx, name, options.reason, (loan) => {
    const from = Math.max(loan.dueAt.getTime(), ctx.clock.now().getTime());
    return addDays(new Date(from), days);
  });
}

/** Sets a due date from an expression: `+14d`, `-7d`, `+2w` or `2026-12-01`. */
export async function setDue(
  ctx: Context,
  name: string,
  expression: string,
  options: { reason?: string } = {},
): Promise<DueChange> {
  return changeDue(ctx, name, options.reason, (loan) => parseDueExpression(expression, loan.dueAt));
}

async function changeDue(
  ctx: Context,
  name: string,
  reason: string | undefined,
  compute: (loan: Loan) => Date,
): Promise<DueChange> {
  const { project } = await requireProject(ctx);
  const { loan } = await inspectBorrowedSkill(ctx, project, name);
  const dueAt = compute(loan);
  const now = ctx.clock.now();
  const latest = addDays(now, ctx.config.maxLoanDays);
  if (dueAt > latest) {
    throw new ShelfError(
      "LOAN_LIMIT",
      `Due date ${dueAt.toISOString()} is beyond the ${ctx.config.maxLoanDays}-day loan limit`,
      `The latest allowed due date is ${latest.toISOString().slice(0, 10)}`,
    );
  }
  writeTransaction(ctx.db, () => {
    setLoanDue(ctx.db, loan.id, dueAt);
    recordEvent(ctx.db, {
      type: "loan.due-changed",
      actor: ctx.actor,
      at: now,
      projectId: project.id,
      skillId: loan.skillId,
      detail: { from: loan.dueAt.toISOString(), to: dueAt.toISOString(), reason: reason ?? null },
    });
  });
  return { skill: name, previousDueAt: loan.dueAt, dueAt };
}

/** Returns a skill: removes its copies and closes the loan. Refuses to discard local edits. */
export async function returnSkill(
  ctx: Context,
  name: string,
  options: { force?: boolean } = {},
): Promise<{ skill: string }> {
  const { project } = await requireProject(ctx);
  const inspection = await inspectBorrowedSkill(ctx, project, name);
  if (!options.force && !isClean(inspection.report.content)) {
    throw new ShelfError(
      "LOCAL_CHANGES",
      `The project copy of "${name}" has local edits`,
      `Keep them with \`shelf promote ${name}\` or \`shelf detach ${name}\`, or discard them with --force`,
    );
  }
  await closeLoanAndFiles(ctx, project, inspection.loan, "loan.returned");
  return { skill: name };
}

/** Stops managing a skill but leaves its files in place, owned by the project. */
export async function detach(ctx: Context, name: string): Promise<{ skill: string }> {
  const { project } = await requireProject(ctx);
  const { loan } = await inspectBorrowedSkill(ctx, project, name);
  await closeLoanAndFiles(ctx, project, loan, "loan.detached");
  return { skill: name };
}

/** Closes a loan. Detaching keeps the files; every other reason removes them. */
export async function closeLoanAndFiles(
  ctx: Context,
  project: Project,
  loan: Loan,
  reason: Extract<EventType, "loan.returned" | "loan.expired" | "loan.detached">,
): Promise<void> {
  if (reason !== "loan.detached")
    await removeSkillCopies(project.path, loan.targets, loan.skillName);
  const now = ctx.clock.now();
  writeTransaction(ctx.db, () => {
    closeLoan(ctx.db, loan.id, now);
    recordEvent(ctx.db, {
      type: reason,
      actor: ctx.actor,
      at: now,
      projectId: project.id,
      skillId: loan.skillId,
    });
    syncLockfile(ctx.db, project);
  });
}

export interface UpdateResult {
  readonly skill: string;
  readonly status: "updated" | "current" | "skipped-local-changes";
  readonly revision: RevisionHash;
}

/**
 * Brings borrowed skills up to the library's latest revision. With no names, updates
 * every loan and skips (rather than fails on) copies with local edits.
 */
export async function update(
  ctx: Context,
  names: readonly string[] = [],
  options: { force?: boolean } = {},
): Promise<UpdateResult[]> {
  const { project } = await requireProject(ctx);
  const inspections =
    names.length > 0
      ? await Promise.all(names.map((name) => inspectBorrowedSkill(ctx, project, name)))
      : await inspectLoans(ctx, project);

  const results: UpdateResult[] = [];
  for (const inspection of inspections) {
    const { report } = inspection;
    if (report.content === "current") {
      results.push({ skill: report.skill, status: "current", revision: report.revision });
      continue;
    }
    if (!options.force && !isClean(report.content)) {
      if (names.length > 0) {
        throw new ShelfError(
          "LOCAL_CHANGES",
          `The project copy of "${report.skill}" has local edits`,
          `Keep them with \`shelf promote ${report.skill}\`, or discard them with --force`,
        );
      }
      results.push({
        skill: report.skill,
        status: "skipped-local-changes",
        revision: report.revision,
      });
      continue;
    }
    await moveLoanToRevision(ctx, project, inspection, report.latestRevision, "loan.updated");
    results.push({ skill: report.skill, status: "updated", revision: report.latestRevision });
  }
  return results;
}

/** Rewrites a loan's copies from `revision` and records it as the loan's base. */
export async function moveLoanToRevision(
  ctx: Context,
  project: Project,
  { loan }: LoanInspection,
  revision: RevisionHash,
  reason: Extract<EventType, "loan.updated" | "loan.restored">,
): Promise<void> {
  await writeSkillCopies(
    project.path,
    loan.targets,
    loan.skillName,
    revisionPath(ctx.paths, revision),
  );
  const now = ctx.clock.now();
  writeTransaction(ctx.db, () => {
    setLoanRevision(ctx.db, loan.id, revision);
    recordEvent(ctx.db, {
      type: reason,
      actor: ctx.actor,
      at: now,
      projectId: project.id,
      skillId: loan.skillId,
      detail: { from: loan.revision, to: revision },
    });
    syncLockfile(ctx.db, project);
  });
}

/**
 * Rewrites only the copies that are missing. Remaining copies are unmodified (that
 * is what `missing` means), so one of them is the preferred source; otherwise the
 * base revision; otherwise — on a machine that never stored the base — the latest.
 */
export async function restoreMissingCopies(
  ctx: Context,
  project: Project,
  inspection: LoanInspection,
): Promise<void> {
  const { loan, working, skill } = inspection;
  const missing = loan.targets.filter((_, index) => working[index] === null);
  const presentIndex = working.findIndex((hash) => hash !== null);
  const base = revisionPath(ctx.paths, loan.revision);

  let source: string;
  if (presentIndex >= 0) {
    source = skillCopyPath(project.path, loan.targets[presentIndex] as string, loan.skillName);
  } else if (await pathExists(base)) {
    source = base;
  } else {
    await moveLoanToRevision(ctx, project, inspection, skill.latestRevision, "loan.restored");
    return;
  }

  await writeSkillCopies(project.path, missing, loan.skillName, source);
  writeTransaction(ctx.db, () => {
    recordEvent(ctx.db, {
      type: "loan.restored",
      actor: ctx.actor,
      at: ctx.clock.now(),
      projectId: project.id,
      skillId: loan.skillId,
      detail: { targets: missing },
    });
  });
}

export interface PromoteResult {
  readonly skill: string;
  readonly previousRevision: RevisionHash;
  readonly revision: RevisionHash;
}

/**
 * Publishes a project's edited copy back to the library as a new revision. Refuses
 * when the library has also moved on since the loan's revision, unless forced.
 */
export async function promote(
  ctx: Context,
  name: string,
  options: { force?: boolean } = {},
): Promise<PromoteResult> {
  const { project } = await requireProject(ctx);
  const inspection = await inspectBorrowedSkill(ctx, project, name);
  const { loan, skill, working, report } = inspection;

  if (report.content === "missing") {
    throw new ShelfError(
      "CONFLICT",
      `Copies of "${name}" are missing`,
      "Run `shelf sync` to restore them",
    );
  }
  if (report.content === "current" || report.content === "behind") {
    throw new ShelfError(
      "INVALID_ARGUMENT",
      `The project copy of "${name}" has no local edits to promote`,
    );
  }
  if (report.content === "diverged" && !options.force) {
    throw new ShelfError(
      "CONFLICT",
      `The library's "${name}" changed since this project borrowed it`,
      "Promoting would replace the newer library revision; re-run with --force to do so",
    );
  }
  const edited = new Set(working.filter((hash) => hash !== loan.revision));
  if (edited.size > 1) {
    throw new ShelfError(
      "CONFLICT",
      `The copies of "${name}" in ${loan.targets.join(", ")} were edited differently`,
      "Make the copies identical, then promote again",
    );
  }

  const sourceIndex = working.findIndex((hash) => hash !== loan.revision);
  const source = skillCopyPath(project.path, loan.targets[sourceIndex] as string, name);
  await readSkillMetadata(source); // never promote an invalid skill into the library
  await replaceDirectory(source, librarySkillPath(ctx.paths, name));
  const revision = await snapshotSkill(ctx.paths, name);
  const { description } = await readSkillMetadata(librarySkillPath(ctx.paths, name));
  await writeSkillCopies(project.path, loan.targets, name, revisionPath(ctx.paths, revision));

  const now = ctx.clock.now();
  writeTransaction(ctx.db, () => {
    updateSkillHead(ctx.db, skill.id, { description, revision });
    insertRevision(ctx.db, {
      skillId: skill.id,
      hash: revision,
      parent: skill.latestRevision,
      source: "promote",
      at: now,
    });
    setLoanRevision(ctx.db, loan.id, revision);
    recordEvent(ctx.db, {
      type: "skill.revised",
      actor: ctx.actor,
      at: now,
      projectId: project.id,
      skillId: skill.id,
      detail: { revision, source: "promote" },
    });
    syncLockfile(ctx.db, project);
  });
  return { skill: name, previousRevision: skill.latestRevision, revision };
}

function assertWithinLoanLimit(ctx: Context, days: number): void {
  if (days > ctx.config.maxLoanDays) {
    throw new ShelfError(
      "LOAN_LIMIT",
      `${days} days exceeds the ${ctx.config.maxLoanDays}-day loan limit`,
      `Use --days ${ctx.config.maxLoanDays} or less`,
    );
  }
}

function pickLoan(loan: Loan): { revision: RevisionHash; dueAt: Date; targets: readonly string[] } {
  return { revision: loan.revision, dueAt: loan.dueAt, targets: loan.targets };
}
