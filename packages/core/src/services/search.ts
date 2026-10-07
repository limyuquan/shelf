import { join } from "node:path";
import type { Skill } from "../domain/types.ts";
import { listFiles } from "../library/hash.ts";
import { librarySkillPath } from "../library/library.ts";
import { SKILL_FILE } from "../library/skill-file.ts";
import {
  parseQuery,
  type SearchableSkill,
  type SearchOptions,
  type SearchResult,
  searchSkills,
  type TextFile,
  textFile,
} from "../library/text-search.ts";
import { listSkills } from "../store/skills.ts";
import type { Context } from "./context.ts";
import { readSkillFile, refreshLibrary } from "./library.ts";

export {
  hitRanges,
  type MatchRange,
  parseQuery,
  type SearchableSkill,
  type SearchMatch,
  type SearchOptions,
  type SearchResult,
  SNIPPET_LENGTH,
  searchSkills,
  snippet,
} from "../library/text-search.ts";

/**
 * Full-text search over the library: names, descriptions, SKILL.md bodies and
 * text reference files (ranked by `library/text-search.ts`).
 *
 * There is deliberately no index. A library holds tens to hundreds of small
 * skills, so reading every file once per search takes milliseconds, and the
 * library is edited with any tool, so an index would need its own invalidation
 * on top of `refreshLibrary`. Revisit if libraries grow to thousands of skills.
 */

/** Skills searched concurrently, so a large library doesn't open every file at once. */
const BATCH = 32;

/** Library skills whose content contains every term of `query`, best first. */
export async function searchLibrary(
  ctx: Context,
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  if (parseQuery(query).length === 0) return [];
  return searchSkills(await searchableSkills(ctx), query, options);
}

/** Every library skill with its text files, as `searchSkills` reads them. */
export async function searchableSkills(ctx: Context): Promise<SearchableSkill[]> {
  await refreshLibrary(ctx);
  const skills = listSkills(ctx.db);
  const searchable: SearchableSkill[] = [];
  for (let i = 0; i < skills.length; i += BATCH) {
    const batch = skills.slice(i, i + BATCH);
    searchable.push(...(await Promise.all(batch.map((skill) => readSearchable(ctx, skill)))));
  }
  return searchable;
}

async function readSearchable(ctx: Context, skill: Skill): Promise<SearchableSkill> {
  return {
    name: skill.name,
    description: skill.description,
    files: await readTextFiles(librarySkillPath(ctx.paths, skill.name)),
  };
}

/** SKILL.md first, then every other text file, in path order. */
async function readTextFiles(dir: string): Promise<TextFile[]> {
  const paths = await listFiles(dir);
  const ordered = [SKILL_FILE, ...paths.filter((path) => path !== SKILL_FILE)];
  const files = await Promise.all(
    ordered.map((path) =>
      readSkillFile("", { absolute: join(dir, path), relative: path }).catch(() => null),
    ),
  );
  const text: TextFile[] = [];
  for (const file of files) {
    if (file?.content == null) continue; // binary, oversized, or vanished mid-search
    text.push(textFile(file.path, file.content));
  }
  return text;
}
