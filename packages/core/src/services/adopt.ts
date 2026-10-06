import { relative, resolve } from "node:path";
import { addDays } from "../domain/due.ts";
import type { ContentState, RevisionHash, Skill } from "../domain/types.ts";
import { ShelfError } from "../errors.ts";
import { copyDirectory, pathExists } from "../library/fs.ts";
import { hashDirectory } from "../library/hash.ts";
import { librarySkillPath, snapshotDirectory } from "../library/library.ts";
import { readSkillMetadata } from "../library/skill-file.ts";
import { locateSkillCopy } from "../projection/locate.ts";
import { distinctTargets, skillCopyPath, writeSkillCopies } from "../projection/materialize.ts";
import { auditDirectory, type Finding } from "../security/audit.ts";
import { writeTransaction } from "../store/database.ts";
import { recordEvent } from "../store/events.ts";
import { findActiveLoan, insertLoan } from "../store/loans.ts";
import { insertRevision, listRevisions } from "../store/skills.ts";
import { type Context, withCwd } from "./context.ts";
import { inspectBorrowedSkill } from "./inspect.ts";
import { refreshLibrary, requireSkill } from "./library.ts";
import {
  findProjectRoot,
  initProject,
  projectTargets,
  requireProject,
  syncLockfile,
} from "./project.ts";

export interface AdoptResult {
  readonly path: string;
  readonly skill: string;
  /**
   * `imported`: the library had no such skill, so this copy became it.
   * `matched`: the copy is identical to the library's latest revision.
   * `older`: the copy is an earlier revision — one shelf knows, or any copy when
   * adopting with `unedited` — so its loan is `behind` and `shelf update` applies.
   * `differs`: the library already has a different version; it was left untouched
   * and the copy is adopted as a loan with local edits (`modified`).
   */
  readonly library: "imported" | "matched" | "older" | "differs";
  /** The revision the loan starts from. */
  readonly revision: RevisionHash;
  readonly loan: {
    readonly project: string;
    readonly status: "created" | "already-borrowed";
    readonly content: ContentState;
  } | null;
  /** Why no loan was created, when `loan` is null. */
  readonly note: string | null;
  /** Security findings in the adopted copy, for review (adopting is never blocked). */
  readonly findings: Finding[];
}

export interface AdoptOptions {
  /**
   * The copies carry no local edits: any that differ from the library are older
   * versions (e.g. installed from upstream at different times). They are recorded
   * as revisions so their loans are `behind` rather than `modified`. Adopt the
   * newest copy first; it becomes the library version.
   */
  readonly unedited?: boolean;
}

/**
 * Brings existing, hand-copied skills under shelf's management: imports each into
 * the library if it is new there, and turns copies inside a project's skill
 * directory into loans. Never overwrites a library skill — differing copies
 * become `modified` loans to promote or discard, unless they match an earlier
 * revision (or `unedited` says they are one).
 */
export async function adopt(
  ctx: Context,
  paths: readonly string[],
  options: AdoptOptions = {},
): Promise<AdoptResult[]> {
  if (paths.length === 0)
    throw new ShelfError("INVALID_ARGUMENT", "Name at least one skill directory");
  const results: AdoptResult[] = [];
  for (const path of paths) results.push(await adoptOne(ctx, resolve(ctx.cwd, path), options));
  return results;
}

async function adoptOne(ctx: Context, path: string, options: AdoptOptions): Promise<AdoptResult> {
  if (!relative(ctx.paths.home, path).startsWith("..")) {
    throw new ShelfError(
      "INVALID_ARGUMENT",
      `${path} is inside the shelf home; it is already managed`,
    );
  }
  const { name } = await readSkillMetadata(path);
  await refreshLibrary(ctx);

  const hash = await hashDirectory(path);
  let library: AdoptResult["library"];
  if (!(await pathExists(librarySkillPath(ctx.paths, name)))) {
    await copyDirectory(path, librarySkillPath(ctx.paths, name));
    await refreshLibrary(ctx);
    library = "imported";
  } else {
    library = await compareWithLibrary(ctx, requireSkill(ctx, name), path, hash, options);
  }
  const skill = requireSkill(ctx, name);
  const revision = library === "older" ? hash : skill.latestRevision;
  const findings = await auditDirectory(path);
  const base = { path, skill: name, library, revision, findings };

  const location = locateSkillCopy(path);
  if (!location) {
    return {
      ...base,
      loan: null,
      note: "Not inside a project skill directory (<root>/.<harness>/skills/)",
    };
  }
  if ((await findProjectRoot(location.root)) !== location.root) {
    return { ...base, loan: null, note: `${location.root} is nested inside another project` };
  }

  const projectCtx = withCwd(ctx, location.root);
  await initProject(projectCtx);
  const { project } = await requireProject(projectCtx);
  if (findActiveLoan(ctx.db, project.id, name)) {
    const { report } = await inspectBorrowedSkill(ctx, project, name);
    return {
      ...base,
      loan: { project: project.name, status: "already-borrowed", content: report.content },
      note: null,
    };
  }

  // Manage this copy where it is, plus the configured targets. Targets without a
  // copy get this copy's content, so every copy of the loan starts out identical.
  const targets = await distinctTargets(project.path, [
    ...(await projectTargets(ctx, project)),
    location.target,
  ]);
  const absent: string[] = [];
  for (const target of targets) {
    if (!(await pathExists(skillCopyPath(project.path, target, name)))) absent.push(target);
  }
  await writeSkillCopies(project.path, { targets, mode: "copy" }, name, path, absent);

  const now = ctx.clock.now();
  writeTransaction(ctx.db, () => {
    insertLoan(ctx.db, {
      projectId: project.id,
      skillId: skill.id,
      revision,
      targets,
      policy: "pinned",
      borrowedAt: now,
      dueAt: addDays(now, ctx.config.loanDays),
    });
    recordEvent(ctx.db, {
      type: "loan.adopted",
      actor: ctx.actor,
      at: now,
      projectId: project.id,
      skillId: skill.id,
      detail: { source: path, library, revision },
    });
    syncLockfile(ctx.db, project);
  });
  const { report } = await inspectBorrowedSkill(ctx, project, name);
  return {
    ...base,
    loan: { project: project.name, status: "created", content: report.content },
    note: null,
  };
}

async function compareWithLibrary(
  ctx: Context,
  skill: Skill,
  path: string,
  hash: RevisionHash,
  options: AdoptOptions,
): Promise<AdoptResult["library"]> {
  if (skill.latestRevision === hash) return "matched";
  if (listRevisions(ctx.db, skill.id).some((revision) => revision.hash === hash)) return "older";
  if (!options.unedited) return "differs";
  const stored = await snapshotDirectory(ctx.paths, path);
  writeTransaction(ctx.db, () => {
    insertRevision(ctx.db, {
      skillId: skill.id,
      hash: stored,
      parent: null,
      source: "adopt",
      at: ctx.clock.now(),
    });
  });
  return "older";
}
