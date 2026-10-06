import { dirname, isAbsolute, join, normalize, sep } from "node:path";
import { ShelfError } from "../errors.ts";
import { copyDirectory, pathExists } from "../library/fs.ts";
import { revisionPath } from "../library/library.ts";
import { findHarness, HARNESSES } from "../projection/harnesses.ts";
import { readLockfileSync, writeLockfileSync } from "../projection/lockfile.ts";
import { removeSkillCopies, skillCopyPath, writeSkillCopies } from "../projection/materialize.ts";
import { writeTransaction } from "../store/database.ts";
import { setLoanTargets } from "../store/loans.ts";
import type { Context } from "./context.ts";
import { inspectLoans, type LoanInspection } from "./inspect.ts";
import { projectTargets, requireProject, syncLockfile } from "./project.ts";

export interface TargetsReport {
  readonly targets: string[];
  /** True when the project overrides the user's default targets. */
  readonly custom: boolean;
  readonly harnesses: {
    readonly id: string;
    readonly label: string;
    readonly dir: string;
    readonly enabled: boolean;
    /** Already covered through `.agents/skills`. */
    readonly readsAgentsDir: boolean;
    /** The harness's config directory exists in this project (e.g. `.kiro/`). */
    readonly detected: boolean;
  }[];
}

/** This project's skill directories and every known harness, with what is detected. */
export async function describeTargets(ctx: Context): Promise<TargetsReport> {
  const { project } = await requireProject(ctx);
  const targets = [...(await projectTargets(ctx, project))];
  const custom = Boolean(readLockfileSync(project.path)?.targets);
  const harnesses = await Promise.all(
    HARNESSES.map(async (harness) => ({
      id: harness.id,
      label: harness.label,
      dir: harness.projectDir,
      enabled: targets.includes(harness.projectDir),
      readsAgentsDir: harness.readsAgentsDir,
      detected: await pathExists(join(project.path, dirname(harness.projectDir))),
    })),
  );
  return { targets, custom, harnesses };
}

export interface TargetsChange {
  readonly add?: readonly string[];
  readonly remove?: readonly string[];
  /** Drop the project override and use the user's default targets again. */
  readonly reset?: boolean;
}

/**
 * Changes where this project's skills are written, then moves every loan to the
 * new set: copies appear in added directories and leave removed ones. Removing a
 * copy with local edits is refused unless forced.
 */
export async function changeTargets(
  ctx: Context,
  change: TargetsChange,
  options: { force?: boolean } = {},
): Promise<TargetsReport> {
  const { project } = await requireProject(ctx);
  const current = [...(await projectTargets(ctx, project))];
  const add = (change.add ?? []).map(resolveTarget);
  const remove = new Set((change.remove ?? []).map(resolveTarget));
  const next = change.reset
    ? [...ctx.config.targets]
    : [...current.filter((t) => !remove.has(t)), ...add.filter((t) => !current.includes(t))];
  if (next.length === 0) {
    throw new ShelfError("INVALID_ARGUMENT", "A project needs at least one skill directory");
  }

  const inspections = await inspectLoans(ctx, project);
  const plans = inspections.map((inspection) => planLoan(inspection, current, next));
  if (!options.force) {
    for (const { inspection, dropped } of plans) assertNoEditsIn(inspection, dropped);
  }

  for (const { inspection, targets, dropped, added } of plans) {
    const { loan } = inspection;
    const source = await cleanSource(ctx, project.path, inspection);
    await removeSkillCopies(project.path, dropped, loan.skillName);
    // In link mode the primary copy may have changed, so rewrite every target.
    const only = loan.mode === "link" ? targets : added;
    if (source && only.length > 0) {
      await writeSkillCopies(
        project.path,
        { targets, mode: loan.mode },
        loan.skillName,
        source,
        only,
      );
    }
  }

  writeTransaction(ctx.db, () => {
    for (const { inspection, targets } of plans)
      setLoanTargets(ctx.db, inspection.loan.id, targets);
    const lockfile = readLockfileSync(project.path);
    if (lockfile) {
      const { targets: _previous, ...rest } = lockfile;
      writeLockfileSync(project.path, change.reset ? rest : { ...rest, targets: next });
    }
    syncLockfile(ctx.db, project);
  });
  return describeTargets(ctx);
}

/** Accepts a harness id (`kiro`) or a project-relative directory (`.kiro/skills`). */
function resolveTarget(value: string): string {
  const harness = findHarness(value);
  if (harness) return harness.projectDir;
  const normalized = normalize(value).split(sep).join("/").replace(/\/+$/, "");
  if (isAbsolute(value) || normalized.startsWith("..") || normalized === ".") {
    throw new ShelfError(
      "INVALID_ARGUMENT",
      `"${value}" is not a harness id or a directory inside the project`,
      `Known harnesses: ${HARNESSES.map((h) => h.id).join(", ")}`,
    );
  }
  return normalized;
}

function planLoan(inspection: LoanInspection, current: string[], next: string[]) {
  const loanTargets = inspection.loan.targets;
  // Loan-specific extras (e.g. an adopted `.cursor/skills` copy) are kept.
  const extras = loanTargets.filter((t) => !current.includes(t));
  const targets = [...next, ...extras.filter((t) => !next.includes(t))];
  return {
    inspection,
    targets,
    dropped: loanTargets.filter((t) => !targets.includes(t)),
    added: targets.filter((t) => !loanTargets.includes(t)),
  };
}

function assertNoEditsIn(inspection: LoanInspection, dropped: readonly string[]): void {
  const { loan, working } = inspection;
  for (const target of dropped) {
    const hash = working[loan.targets.indexOf(target)];
    if (hash && hash !== loan.revision) {
      throw new ShelfError(
        "LOCAL_CHANGES",
        `${target}/${loan.skillName} has local edits and would be removed`,
        `Promote them first (\`shelf promote ${loan.skillName}\`) or re-run with --force`,
      );
    }
  }
}

/**
 * An unmodified source for the loan's content: the stored base revision, or — on
 * a machine that never stored it — an unedited copy, which is then stored.
 */
async function cleanSource(
  ctx: Context,
  projectPath: string,
  { loan, working }: LoanInspection,
): Promise<string | null> {
  const base = revisionPath(ctx.paths, loan.revision);
  if (await pathExists(base)) return base;
  const index = working.indexOf(loan.revision);
  if (index < 0) return null;
  await copyDirectory(
    skillCopyPath(projectPath, loan.targets[index] as string, loan.skillName),
    base,
  );
  return base;
}
