import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { assertSkillName } from "../domain/skill-name.ts";
import type { RevisionHash, Skill } from "../domain/types.ts";
import { ShelfError } from "../errors.ts";
import { pathExists } from "../library/fs.ts";
import { hashDirectory } from "../library/hash.ts";
import { librarySkillPath, listLibrarySkills, snapshotSkill } from "../library/library.ts";
import { readSkillMetadata, renderSkillTemplate, SKILL_FILE } from "../library/skill-file.ts";
import { writeTransaction } from "../store/database.ts";
import { recordEvent } from "../store/events.ts";
import {
  archiveSkill,
  countRevisions,
  findSkillByName,
  insertRevision,
  insertSkill,
  listSkills,
  updateSkillHead,
} from "../store/skills.ts";
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
    matches.map(async (skill) => ({
      name: skill.name,
      description: skill.description,
      revision: skill.latestRevision,
      revisions: countRevisions(ctx.db, skill.id),
      tokens: Math.ceil((await readSkillFile(ctx, skill.name)).length / 4),
    })),
  );
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
  const content = await readSkillFile(ctx, name);
  const files = (await readdir(dir, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1))
    .sort();
  return {
    name: skill.name,
    description: skill.description,
    revision: skill.latestRevision,
    revisions: countRevisions(ctx.db, skill.id),
    tokens: Math.ceil(content.length / 4),
    path: dir,
    files,
    content,
  };
}

function readSkillFile(ctx: Context, name: string): Promise<string> {
  return readFile(join(librarySkillPath(ctx.paths, name), SKILL_FILE), "utf8");
}
