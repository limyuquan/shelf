import { isValidSkillName } from "../domain/skill-name.ts";
import { ShelfError } from "../errors.ts";
import { writeTransaction } from "../store/database.ts";
import { recordEvent } from "../store/events.ts";
import {
  deleteSkillSet,
  findSkillSet,
  listSkillSets,
  type SkillSetRecord,
  upsertSkillSet,
} from "../store/sets.ts";
import type { Context } from "./context.ts";
import { refreshLibrary, requireSkill } from "./library.ts";

/**
 * A named group of library skills, borrowed in one step as `@name`. Sets are a
 * machine-local convenience: borrowing one creates ordinary per-skill loans, and
 * nothing about the set reaches a project or its lockfile.
 */
export interface SkillSet {
  readonly name: string;
  readonly description: string;
  /** Member skills, alphabetical. Archived skills are left out. */
  readonly skills: readonly string[];
}

const SET_PREFIX = "@";

const toSkillSet = (set: SkillSetRecord): SkillSet => ({
  name: set.name,
  description: set.description,
  skills: set.skills,
});

function assertSetName(name: string): void {
  if (isValidSkillName(name)) return;
  throw new ShelfError(
    "INVALID_ARGUMENT",
    `Invalid set name "${name}"`,
    "Set names follow the skill-name rules: 1-64 lowercase letters, digits and single hyphens, e.g. frontend",
  );
}

function requireSet(ctx: Context, name: string): SkillSetRecord {
  const set = findSkillSet(ctx.db, name);
  if (!set) {
    throw new ShelfError(
      "SKILL_NOT_FOUND",
      `No set named "${name}"`,
      "Run `shelf set list` to see your sets",
    );
  }
  return set;
}

export async function listSets(ctx: Context): Promise<SkillSet[]> {
  await refreshLibrary(ctx);
  return listSkillSets(ctx.db).map(toSkillSet);
}

/**
 * Creates a set or replaces its members (and description, when given). Skills
 * may include `@set` refs, e.g. to extend a set. Every skill must be in the library.
 */
export async function saveSet(
  ctx: Context,
  name: string,
  input: { description?: string; skills: readonly string[] },
): Promise<SkillSet> {
  const setName = name.startsWith(SET_PREFIX) ? name.slice(SET_PREFIX.length) : name;
  assertSetName(setName);
  await refreshLibrary(ctx);
  const names = resolveSkillRefs(ctx, input.skills);
  if (names.length === 0) {
    throw new ShelfError(
      "INVALID_ARGUMENT",
      "A set needs at least one skill",
      `shelf set save ${setName} <skill…>`,
    );
  }
  const skills = names.map((skill) => requireSkill(ctx, skill));
  const existing = findSkillSet(ctx.db, setName);
  const description = (input.description ?? existing?.description ?? "").trim();
  const at = ctx.clock.now();
  writeTransaction(ctx.db, () => {
    upsertSkillSet(
      ctx.db,
      { name: setName, description, at },
      skills.map((skill) => skill.id),
    );
    recordEvent(ctx.db, {
      type: "set.saved",
      actor: ctx.actor,
      at,
      detail: { set: setName, skills: names, ...(existing ? {} : { created: true }) },
    });
  });
  return toSkillSet(requireSet(ctx, setName));
}

export async function deleteSet(ctx: Context, name: string): Promise<SkillSet> {
  const setName = name.startsWith(SET_PREFIX) ? name.slice(SET_PREFIX.length) : name;
  const set = requireSet(ctx, setName);
  writeTransaction(ctx.db, () => {
    deleteSkillSet(ctx.db, setName);
    recordEvent(ctx.db, {
      type: "set.deleted",
      actor: ctx.actor,
      at: ctx.clock.now(),
      detail: { set: setName, skills: set.skills },
    });
  });
  return toSkillSet(set);
}

/**
 * Expands `@set` refs into their member skills, keeping the order given and
 * dropping duplicates. Plain names pass through unchecked; callers validate them.
 */
export function resolveSkillRefs(ctx: Context, refs: readonly string[]): string[] {
  const names = new Set<string>();
  for (const ref of refs) {
    if (!ref.startsWith(SET_PREFIX)) {
      names.add(ref);
      continue;
    }
    const set = requireSet(ctx, ref.slice(SET_PREFIX.length));
    if (set.skills.length === 0) {
      throw new ShelfError(
        "INVALID_ARGUMENT",
        `Set "${set.name}" has no skills in the library`,
        `shelf set save ${set.name} <skill…>`,
      );
    }
    for (const skill of set.skills) names.add(skill);
  }
  return [...names];
}
