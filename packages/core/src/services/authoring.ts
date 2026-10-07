import { mkdir, readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { assertSkillName } from "../domain/skill-name.ts";
import type { Skill } from "../domain/types.ts";
import { ShelfError } from "../errors.ts";
import {
  copyDirectory,
  pathExists,
  removeDirectory,
  stagingPath,
  writeFileAtomic,
} from "../library/fs.ts";
import { librarySkillPath, listLibrarySkills, snapshotSkill } from "../library/library.ts";
import { type LintResult, lintSkill } from "../library/lint.ts";
import { parseSkillMetadata, SKILL_FILE, setFrontmatterName } from "../library/skill-file.ts";
import { writeTransaction } from "../store/database.ts";
import { recordEvent } from "../store/events.ts";
import { listActiveLoansForSkill } from "../store/loans.ts";
import { findProjectById } from "../store/projects.ts";
import { archiveSkill, findSkillByName, renameSkillRow } from "../store/skills.ts";
import type { Context } from "./context.ts";
import {
  recordRevision,
  refreshLibrary,
  requireSkill,
  type SkillDetail,
  showSkill,
  skillNotFound,
} from "./library.ts";

/**
 * Renames a library skill: its directory, the frontmatter `name:` (nothing else in
 * SKILL.md changes) and its database row, so revisions, loans and events stay
 * attached. Borrowed skills are refused: project copies and lockfiles carry the
 * old name, and renaming would orphan them.
 */
export async function renameSkill(ctx: Context, from: string, to: string): Promise<SkillDetail> {
  await refreshLibrary(ctx);
  const skill = requireSkill(ctx, from);
  if (to === from) throw new ShelfError("INVALID_ARGUMENT", `${from} already has that name`);
  await assertNameFree(ctx, to);
  assertNotBorrowed(ctx, skill, "Renaming");

  const dir = librarySkillPath(ctx.paths, from);
  const target = librarySkillPath(ctx.paths, to);
  const content = await renamedContent(join(dir, SKILL_FILE), from, to);
  await rename(dir, target);
  await writeFileAtomic(join(target, SKILL_FILE), content);
  writeTransaction(ctx.db, () => {
    renameSkillRow(ctx.db, skill.id, to);
    recordEvent(ctx.db, {
      type: "skill.renamed",
      actor: ctx.actor,
      at: ctx.clock.now(),
      skillId: skill.id,
      detail: { from, to },
    });
  });
  // Records the changed SKILL.md as a revision of the same skill.
  await refreshLibrary(ctx);
  return showSkill(ctx, to);
}

/** Copies a library skill to a new name: a new skill with its own history. */
export async function duplicateSkill(ctx: Context, from: string, to: string): Promise<SkillDetail> {
  await refreshLibrary(ctx);
  requireSkill(ctx, from);
  await assertNameFree(ctx, to);

  const target = librarySkillPath(ctx.paths, to);
  // Staged outside the library so a concurrent refresh never sees a half-made skill.
  const staging = stagingPath(join(ctx.paths.home, to));
  try {
    await copyDirectory(librarySkillPath(ctx.paths, from), staging);
    const file = join(staging, SKILL_FILE);
    await writeFileAtomic(file, await renamedContent(file, from, to));
    await rename(staging, target);
  } finally {
    await removeDirectory(staging);
  }

  const { description } = parseSkillMetadata(
    await readFile(join(target, SKILL_FILE), "utf8"),
    to,
    join(target, SKILL_FILE),
  );
  const revision = await snapshotSkill(ctx.paths, to);
  recordRevision(ctx, {
    name: to,
    description,
    revision,
    existing: null,
    detail: { duplicatedFrom: from },
  });
  return showSkill(ctx, to);
}

export interface ArchiveResult {
  readonly skill: string;
  /** Where the directory went. Move it back into the library to restore it. */
  readonly path: string;
}

/**
 * Takes a skill out of the library without deleting anything: the directory moves
 * to `archive/<name>-<timestamp>/` and its revisions stay in `objects/`. Moving the
 * directory back into the library restores it with its history.
 */
export async function archiveLibrarySkill(
  ctx: Context,
  name: string,
  options: { reason?: string } = {},
): Promise<ArchiveResult> {
  await refreshLibrary(ctx);
  const skill = requireSkill(ctx, name);
  assertNotBorrowed(ctx, skill, "Archiving");

  const at = ctx.clock.now();
  const stamp = at.toISOString().slice(0, 19).replaceAll(":", "-");
  let path = join(ctx.paths.archive, `${name}-${stamp}`);
  for (let n = 2; await pathExists(path); n++)
    path = join(ctx.paths.archive, `${name}-${stamp}-${n}`);
  await mkdir(ctx.paths.archive, { recursive: true });
  await rename(librarySkillPath(ctx.paths, name), path);

  writeTransaction(ctx.db, () => {
    archiveSkill(ctx.db, skill.id, at);
    recordEvent(ctx.db, {
      type: "skill.archived",
      actor: ctx.actor,
      at,
      skillId: skill.id,
      detail: { reason: options.reason ?? "archived", path },
    });
  });
  return { skill: name, path };
}

export interface SkillLint extends LintResult {
  readonly skill: string;
}

/**
 * Lints library skills' SKILL.md files (all of them when no names are given).
 * Goes by the library's directories, not the database, so skills that fail to
 * load (and so are missing from the catalog) are reported rather than skipped.
 */
export async function lintLibrary(
  ctx: Context,
  names: readonly string[] = [],
): Promise<SkillLint[]> {
  await refreshLibrary(ctx);
  const library = await listLibrarySkills(ctx.paths);
  const chosen = names.length > 0 ? names : library;
  return Promise.all(
    chosen.map(async (name) => {
      if (!library.includes(name)) throw skillNotFound(name);
      const content = await readFile(join(librarySkillPath(ctx.paths, name), SKILL_FILE), "utf8");
      return { skill: name, ...lintSkill(content, name) };
    }),
  );
}

async function renamedContent(file: string, from: string, to: string): Promise<string> {
  const content = setFrontmatterName(await readFile(file, "utf8"), from, to, file);
  parseSkillMetadata(content, to, file);
  return content;
}

/**
 * The name must be valid, free in the library, and not held by an archived skill
 * (whose history would otherwise be merged into this one).
 */
async function assertNameFree(ctx: Context, name: string): Promise<void> {
  assertSkillName(name);
  const dir = librarySkillPath(ctx.paths, name);
  if (await pathExists(dir)) {
    throw new ShelfError("SKILL_EXISTS", `Skill "${name}" already exists at ${dir}`);
  }
  if (findSkillByName(ctx.db, name)) {
    throw new ShelfError(
      "SKILL_EXISTS",
      `An archived skill was named "${name}"`,
      `Choose another name, or restore it by moving it from ${ctx.paths.archive} back into the library`,
    );
  }
}

function assertNotBorrowed(ctx: Context, skill: Skill, action: string): void {
  const projects = [
    ...new Set(
      listActiveLoansForSkill(ctx.db, skill.id).map(
        (loan) => findProjectById(ctx.db, loan.projectId)?.name ?? loan.projectId,
      ),
    ),
  ];
  if (projects.length === 0) return;
  const list = projects.join(", ");
  throw new ShelfError(
    "CONFLICT",
    `${skill.name} is borrowed by ${list}. ${action} it would orphan their copies and lockfiles.`,
    `Return it from ${list} first (\`shelf return ${skill.name}\` in each project)`,
  );
}
