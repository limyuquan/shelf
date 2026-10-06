import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createTwoFilesPatch } from "diff";
import type { RevisionHash } from "../domain/types.ts";
import { ShelfError } from "../errors.ts";
import { pathExists } from "../library/fs.ts";
import { listFiles } from "../library/hash.ts";
import { revisionPath } from "../library/library.ts";
import { skillCopyPath } from "../projection/materialize.ts";
import { findActiveLoan } from "../store/loans.ts";
import { listRevisions } from "../store/skills.ts";
import type { Context } from "./context.ts";
import { inspectBorrowedSkill, type LoanInspection } from "./inspect.ts";
import { refreshLibrary, requireSkill } from "./library.ts";
import { openProject } from "./project.ts";
import { matchRevision } from "./revisions.ts";

/**
 * A side of a diff: `borrowed` (the loan's base revision), `library` (latest),
 * `project` (this project's copy on disk), `latest`, or a revision (hash or unique prefix).
 */
export type DiffSide = string;

export interface FileDiff {
  readonly path: string;
  readonly status: "added" | "removed" | "modified";
  /** Unified diff, or a one-line note for binary files. */
  readonly patch: string;
}

export interface DiffResult {
  readonly skill: string;
  readonly from: { readonly side: DiffSide; readonly revision: RevisionHash | null };
  readonly to: { readonly side: DiffSide; readonly revision: RevisionHash | null };
  readonly files: FileDiff[];
}

/**
 * Compares two versions of a skill. Defaults, inside a project that borrows it:
 * local edits (`borrowed` → `project`) when the copy is edited, otherwise pending
 * library changes (`borrowed` → `library`). Elsewhere: the latest library change.
 */
export async function diffSkill(
  ctx: Context,
  name: string,
  options: { from?: DiffSide; to?: DiffSide } = {},
): Promise<DiffResult> {
  await refreshLibrary(ctx);
  const skill = requireSkill(ctx, name);
  const opened = await openProject(ctx);
  const loan: BorrowedCopy | null =
    opened && findActiveLoan(ctx.db, opened.project.id, name)
      ? {
          projectPath: opened.project.path,
          inspection: await inspectBorrowedSkill(ctx, opened.project, name),
        }
      : null;

  const edited = loan && ["modified", "diverged"].includes(loan.inspection.report.content);
  const parent = listRevisions(ctx.db, skill.id).find(
    (rev) => rev.hash === skill.latestRevision,
  )?.parent;
  const fromSide = options.from ?? (loan ? "borrowed" : (parent ?? "library"));
  const toSide = options.to ?? (edited ? "project" : "library");

  const from = await resolveSide(ctx, name, fromSide, loan);
  const to = await resolveSide(ctx, name, toSide, loan);
  return {
    skill: name,
    from: { side: fromSide, revision: from.revision },
    to: { side: toSide, revision: to.revision },
    files: await diffDirectories(from.dir, to.dir),
  };
}

interface BorrowedCopy {
  readonly projectPath: string;
  readonly inspection: LoanInspection;
}

async function resolveSide(
  ctx: Context,
  name: string,
  side: DiffSide,
  borrowed: BorrowedCopy | null,
): Promise<{ dir: string; revision: RevisionHash | null }> {
  const skill = requireSkill(ctx, name);
  if (side === "library") {
    return { dir: revisionPath(ctx.paths, skill.latestRevision), revision: skill.latestRevision };
  }
  if (side === "borrowed" || side === "project") {
    if (!borrowed) {
      throw new ShelfError(
        "NOT_BORROWED",
        `"${side}" needs a project that borrows "${name}"`,
        "Run this inside the project, or compare revisions: --from <hash> --to library",
      );
    }
    const { loan, working } = borrowed.inspection;
    if (side === "borrowed") {
      return { dir: revisionPath(ctx.paths, loan.revision), revision: loan.revision };
    }
    // The edited copy if there is one, else the first copy present.
    let index = working.findIndex((hash) => hash !== null && hash !== loan.revision);
    if (index < 0) index = working.findIndex((hash) => hash !== null);
    if (index < 0)
      throw new ShelfError("CONFLICT", `Copies of "${name}" are missing`, "Run `shelf sync`");
    const dir = skillCopyPath(borrowed.projectPath, loan.targets[index] as string, name);
    return { dir, revision: working[index] ?? null };
  }

  // `latest`, a full hash, or a unique prefix of one.
  const { hash } = matchRevision(ctx, skill, side);
  return { dir: revisionPath(ctx.paths, hash), revision: hash };
}

export async function diffDirectories(fromDir: string, toDir: string): Promise<FileDiff[]> {
  const fromFiles = new Set((await pathExists(fromDir)) ? await listFiles(fromDir) : []);
  const toFiles = new Set((await pathExists(toDir)) ? await listFiles(toDir) : []);
  const diffs: FileDiff[] = [];
  for (const path of [...new Set([...fromFiles, ...toFiles])].sort()) {
    const before = fromFiles.has(path) ? await readFile(join(fromDir, path)) : null;
    const after = toFiles.has(path) ? await readFile(join(toDir, path)) : null;
    if (before && after && before.equals(after)) continue;
    const status = !before ? "added" : !after ? "removed" : "modified";
    diffs.push({ path, status, patch: renderPatch(path, before, after) });
  }
  return diffs;
}

function renderPatch(path: string, before: Buffer | null, after: Buffer | null): string {
  if (before?.includes(0) || after?.includes(0)) return `Binary file ${path} differs`;
  return createTwoFilesPatch(
    before ? `a/${path}` : "/dev/null",
    after ? `b/${path}` : "/dev/null",
    before?.toString("utf8") ?? "",
    after?.toString("utf8") ?? "",
    undefined,
    undefined,
    { headerOptions: { includeIndex: false, includeUnderline: false, includeFileHeaders: true } },
  );
}
