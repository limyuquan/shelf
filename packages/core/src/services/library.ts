import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, normalize, sep } from "node:path";
import { assertSkillName } from "../domain/skill-name.ts";
import type { RevisionHash, Skill } from "../domain/types.ts";
import { ShelfError } from "../errors.ts";
import { pathExists, writeFileAtomic } from "../library/fs.ts";
import { hashDirectory } from "../library/hash.ts";
import { librarySkillPath, listLibrarySkills, snapshotSkill } from "../library/library.ts";
import {
  parseSkillMetadata,
  readSkillMetadata,
  renderSkillTemplate,
  SKILL_FILE,
} from "../library/skill-file.ts";
import { writeTransaction } from "../store/database.ts";
import { recordEvent } from "../store/events.ts";
import { listActiveLoansForSkill } from "../store/loans.ts";
import {
  archiveSkill,
  countRevisions,
  findSkillByName,
  insertRevision,
  insertSkill,
  listSkills,
  updateSkillHead,
} from "../store/skills.ts";
import { findSkillSource } from "../store/sources.ts";
import type { Context } from "./context.ts";

/**
 * Reconciles the database with the library directory. The library is edited with
 * any tool, so every command that reads skills first records new revisions here.
 * Returns warnings for library entries that are not valid skills.
 */
export async function refreshLibrary(ctx: Context): Promise<string[]> {
  const warnings: string[] = [];
  const present = new Set<string>();

  for (const name of await listLibrarySkills(ctx.paths)) {
    present.add(name);
    const dir = librarySkillPath(ctx.paths, name);
    let description: string;
    try {
      ({ description } = await readSkillMetadata(dir));
    } catch (error) {
      if (error instanceof ShelfError) {
        warnings.push(error.message);
        continue;
      }
      throw error;
    }

    const existing = findSkillByName(ctx.db, name);
    const unchanged =
      existing && !existing.archivedAt && existing.latestRevision === (await hashDirectory(dir));
    if (unchanged) continue;

    const revision = await snapshotSkill(ctx.paths, name);
    recordRevision(ctx, { name, description, revision, existing });
  }

  for (const skill of listSkills(ctx.db)) {
    if (present.has(skill.name)) continue;
    writeTransaction(ctx.db, () => {
      archiveSkill(ctx.db, skill.id, ctx.clock.now());
      recordEvent(ctx.db, {
        type: "skill.archived",
        actor: ctx.actor,
        at: ctx.clock.now(),
        skillId: skill.id,
        detail: { reason: "removed from library" },
      });
    });
  }
  return warnings;
}

function recordRevision(
  ctx: Context,
  input: { name: string; description: string; revision: RevisionHash; existing: Skill | null },
): void {
  const at = ctx.clock.now();
  writeTransaction(ctx.db, () => {
    const { existing } = input;
    if (existing) updateSkillHead(ctx.db, existing.id, input); // also un-archives
    // An archived skill restored with unchanged content needs no new revision.
    if (existing?.latestRevision === input.revision) return;

    const skill = existing ?? insertSkill(ctx.db, { ...input, at });
    insertRevision(ctx.db, {
      skillId: skill.id,
      hash: input.revision,
      parent: existing?.latestRevision ?? null,
      source: "library",
      at,
    });
    recordEvent(ctx.db, {
      type: existing ? "skill.revised" : "skill.created",
      actor: ctx.actor,
      at,
      skillId: skill.id,
      detail: { revision: input.revision },
    });
  });
}

export async function createSkill(ctx: Context, name: string, description: string): Promise<Skill> {
  assertSkillName(name);
  const dir = librarySkillPath(ctx.paths, name);
  if (await pathExists(dir)) {
    throw new ShelfError("SKILL_EXISTS", `Skill "${name}" already exists at ${dir}`);
  }
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, SKILL_FILE), renderSkillTemplate(name, description));
  await refreshLibrary(ctx);
  return requireSkill(ctx, name);
}

/**
 * Replaces a library skill's SKILL.md (e.g. from the dashboard editor) and records
 * the new revision. The content is validated before anything is written.
 */
export async function saveSkillContent(
  ctx: Context,
  name: string,
  content: string,
): Promise<SkillDetail> {
  requireSkill(ctx, name);
  const file = join(librarySkillPath(ctx.paths, name), SKILL_FILE);
  parseSkillMetadata(content, name, file);
  await writeFileAtomic(file, content);
  await refreshLibrary(ctx);
  return showSkill(ctx, name);
}

export function requireSkill(ctx: Context, name: string): Skill {
  const skill = findSkillByName(ctx.db, name);
  if (!skill || skill.archivedAt) {
    throw new ShelfError(
      "SKILL_NOT_FOUND",
      `No skill named "${name}" in the library`,
      "Run `shelf catalog` to list available skills",
    );
  }
  return skill;
}

export interface CatalogEntry {
  readonly name: string;
  readonly description: string;
  readonly revision: RevisionHash;
  readonly revisions: number;
  /** Rough size of SKILL.md in tokens (chars / 4), i.e. its cost when loaded. */
  readonly tokens: number;
  /** Projects currently borrowing the skill. */
  readonly borrowers: number;
  /** Where `shelf pull` fetches updates from, if the skill is linked to a source. */
  readonly source: string | null;
}

/** Library skills, optionally filtered: every whitespace-separated term must match. */
export async function catalog(ctx: Context, query = ""): Promise<CatalogEntry[]> {
  await refreshLibrary(ctx);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = listSkills(ctx.db).filter((skill) => {
    const haystack = `${skill.name} ${skill.description}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
  return Promise.all(
    matches.map(async (skill) =>
      catalogEntry(ctx, skill, await readSkillMarkdown(ctx, skill.name)),
    ),
  );
}

function catalogEntry(ctx: Context, skill: Skill, content: string): CatalogEntry {
  return {
    name: skill.name,
    description: skill.description,
    revision: skill.latestRevision,
    revisions: countRevisions(ctx.db, skill.id),
    tokens: Math.ceil(content.length / 4),
    borrowers: listActiveLoansForSkill(ctx.db, skill.id).length,
    source: findSkillSource(ctx.db, skill.id)?.url ?? null,
  };
}

export interface SkillDetail extends CatalogEntry {
  readonly path: string;
  readonly files: string[];
  readonly content: string;
}

export async function showSkill(ctx: Context, name: string): Promise<SkillDetail> {
  await refreshLibrary(ctx);
  const skill = requireSkill(ctx, name);
  const dir = librarySkillPath(ctx.paths, name);
  const content = await readSkillMarkdown(ctx, name);
  const files = (await readdir(dir, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1))
    .sort();
  return {
    ...catalogEntry(ctx, skill, content),
    path: dir,
    files,
    content,
  };
}

function readSkillMarkdown(ctx: Context, name: string): Promise<string> {
  return readFile(join(librarySkillPath(ctx.paths, name), SKILL_FILE), "utf8");
}

/** Largest file the dashboard opens; skills are small, so anything bigger is a mistake. */
const MAX_FILE_BYTES = 1024 * 1024;

export interface LibraryFile {
  readonly skill: string;
  /** Relative to the skill directory, with forward slashes. */
  readonly path: string;
  /** Null for binary or oversized files, which are listed but not shown. */
  readonly content: string | null;
  readonly size: number;
}

/** One file of a library skill (e.g. `references/patterns.md`). */
export async function readLibraryFile(
  ctx: Context,
  name: string,
  path: string,
): Promise<LibraryFile> {
  const file = await resolveLibraryFile(ctx, name, path);
  const bytes = new Uint8Array(await readFile(file.absolute));
  const binary = bytes.length > MAX_FILE_BYTES || bytes.includes(0);
  return {
    skill: name,
    path: file.relative,
    content: binary ? null : new TextDecoder().decode(bytes),
    size: bytes.length,
  };
}

/**
 * Replaces an existing text file of a library skill and records the new revision.
 * SKILL.md goes through `saveSkillContent`, which validates its frontmatter.
 */
export async function saveLibraryFile(
  ctx: Context,
  name: string,
  path: string,
  content: string,
): Promise<LibraryFile> {
  const file = await resolveLibraryFile(ctx, name, path);
  if (file.relative === SKILL_FILE) {
    await saveSkillContent(ctx, name, content);
  } else {
    if ((await readLibraryFile(ctx, name, file.relative)).content === null) {
      throw new ShelfError("INVALID_ARGUMENT", `${file.relative} is not a text file`);
    }
    await writeFileAtomic(file.absolute, content);
    await refreshLibrary(ctx);
  }
  return readLibraryFile(ctx, name, file.relative);
}

/** Only existing files inside the skill directory: no traversal, no new files. */
async function resolveLibraryFile(ctx: Context, name: string, path: string) {
  requireSkill(ctx, name);
  const dir = librarySkillPath(ctx.paths, name);
  const relative = normalize(path).split(sep).join("/");
  const absolute = join(dir, relative);
  const inside = absolute.startsWith(dir + sep) && !relative.split("/").includes("..");
  if (!inside || isAbsolute(path) || !(await stat(absolute).catch(() => null))?.isFile()) {
    throw new ShelfError(
      "INVALID_ARGUMENT",
      `"${path}" is not a file of ${name}`,
      `Run \`shelf show ${name}\` to list its files`,
    );
  }
  return { absolute, relative };
}
