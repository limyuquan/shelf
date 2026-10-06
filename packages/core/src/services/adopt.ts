import { relative, resolve } from "node:path";
import { addDays } from "../domain/due.ts";
import type { ContentState, RevisionHash } from "../domain/types.ts";
import { ShelfError } from "../errors.ts";
import { copyDirectory, pathExists } from "../library/fs.ts";
import { hashDirectory } from "../library/hash.ts";
import { librarySkillPath } from "../library/library.ts";
import { readSkillMetadata } from "../library/skill-file.ts";
import { locateSkillCopy } from "../projection/locate.ts";
import { skillCopyPath, writeSkillCopies } from "../projection/materialize.ts";
import { writeTransaction } from "../store/database.ts";
import { recordEvent } from "../store/events.ts";
import { findActiveLoan, insertLoan } from "../store/loans.ts";
import { type Context, withCwd } from "./context.ts";
import { inspectBorrowedSkill } from "./inspect.ts";
import { refreshLibrary, requireSkill } from "./library.ts";
import { findProjectRoot, initProject, requireProject, syncLockfile } from "./project.ts";

export interface AdoptResult {
  readonly path: string;
  readonly skill: string;
  /**
   * `imported`: the library had no such skill, so this copy became it.
   * `matched`: the copy is identical to the library's latest revision.
   * `differs`: the library already has a different version; it was left untouched
   * and the copy is adopted as a loan with local edits (`modified`).
   */
  readonly library: "imported" | "matched" | "differs";
  readonly revision: RevisionHash;
  readonly loan: {
    readonly project: string;
    readonly status: "created" | "already-borrowed";
    readonly content: ContentState;
  } | null;
  /** Why no loan was created, when `loan` is null. */
  readonly note: string | null;
}

/**
 * Brings existing, hand-copied skills under shelf's management: imports each into
 * the library if it is new there, and turns copies inside a project's skill
 * directory into loans. Never overwrites a library skill — differing copies
 * become `modified` loans to promote or discard.
 */
export async function adopt(ctx: Context, paths: readonly string[]): Promise<AdoptResult[]> {
  if (paths.length === 0)
    throw new ShelfError("INVALID_ARGUMENT", "Name at least one skill directory");
  const results: AdoptResult[] = [];
  for (const path of paths) results.push(await adoptOne(ctx, resolve(ctx.cwd, path)));
  return results;
}

async function adoptOne(ctx: Context, path: string): Promise<AdoptResult> {
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
    library = requireSkill(ctx, name).latestRevision === hash ? "matched" : "differs";
  }
  const skill = requireSkill(ctx, name);
  const base = { path, skill: name, library, revision: skill.latestRevision };

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
  const targets = [...new Set([...ctx.config.targets, location.target])];
  const absent: string[] = [];
  for (const target of targets) {
    if (!(await pathExists(skillCopyPath(project.path, target, name)))) absent.push(target);
  }
  await writeSkillCopies(project.path, absent, name, path);

  const now = ctx.clock.now();
  writeTransaction(ctx.db, () => {
    insertLoan(ctx.db, {
      projectId: project.id,
      skillId: skill.id,
      revision: skill.latestRevision,
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
      detail: { source: path, library },
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
