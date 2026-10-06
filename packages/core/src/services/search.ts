import { join } from "node:path";
import type { Skill } from "../domain/types.ts";
import { listFiles } from "../library/hash.ts";
import { librarySkillPath } from "../library/library.ts";
import { SKILL_FILE } from "../library/skill-file.ts";
import { listSkills } from "../store/skills.ts";
import type { Context } from "./context.ts";
import { readSkillFile, refreshLibrary } from "./library.ts";

/**
 * Full-text search over the library: names, descriptions, SKILL.md bodies and
 * text reference files.
 *
 * There is deliberately no index. A library holds tens to hundreds of small
 * skills, so reading every file once per search takes milliseconds, and the
 * library is edited with any tool, so an index would need its own invalidation
 * on top of `refreshLibrary`. Revisit if libraries grow to thousands of skills.
 */

/** A `[start, end)` character range of a hit within a snippet. */
export type MatchRange = readonly [start: number, end: number];

export interface SearchMatch {
  /** `SKILL.md` or a reference file, relative to the skill directory. */
  readonly file: string;
  /** 1-based line number in `file`. */
  readonly line: number;
  /** About `SNIPPET_LENGTH` characters of the line around the hit, with `…` where cut. */
  readonly snippet: string;
  /** Where the search terms occur in `snippet`. */
  readonly ranges: MatchRange[];
}

export interface SearchResult {
  readonly name: string;
  readonly description: string;
  /** Higher is better; only meaningful relative to other results of the same search. */
  readonly score: number;
  /** Up to `MAX_MATCHES` lines from the skill's files, best first. */
  readonly matches: SearchMatch[];
}

export interface SearchOptions {
  /** Most results to return (default 50). */
  readonly limit?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_MATCHES = 3;
export const SNIPPET_LENGTH = 120;
/** Skills searched concurrently, so a large library doesn't open every file at once. */
const BATCH = 32;

/**
 * Per-term weight of where it matched: a hit in the name outranks any number
 * of hits in the description, which outranks the body, then reference files.
 * Extra occurrences add a little, capped below the next field's weight.
 */
const WEIGHT = { name: 100, description: 30, body: 10, reference: 3 } as const;
const BODY_EXTRA_CAP = 9;
const REFERENCE_EXTRA_CAP = 4;

/**
 * Splits a query into lowercase terms. `"error envelope"` stays one term and
 * matches as a phrase; everything else splits on whitespace.
 */
export function parseQuery(query: string): string[] {
  const terms: string[] = [];
  for (const [, phrase, word] of query.toLowerCase().matchAll(/"([^"]*)"?|(\S+)/g)) {
    const term = (phrase ?? word ?? "").trim().replace(/\s+/g, " ");
    if (term && !terms.includes(term)) terms.push(term);
  }
  return terms;
}

/** Library skills whose content contains every term of `query`, best first. */
export async function searchLibrary(
  ctx: Context,
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const terms = parseQuery(query);
  if (terms.length === 0) return [];
  await refreshLibrary(ctx);

  const skills = listSkills(ctx.db);
  const results: SearchResult[] = [];
  for (let i = 0; i < skills.length; i += BATCH) {
    const batch = skills.slice(i, i + BATCH);
    for (const result of await Promise.all(batch.map((skill) => searchSkill(ctx, skill, terms)))) {
      if (result) results.push(result);
    }
  }
  results.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return results.slice(0, options.limit ?? DEFAULT_LIMIT);
}

interface TextFile {
  readonly path: string;
  /** Lines to search, with their 1-based numbers (SKILL.md skips its frontmatter). */
  readonly lines: { readonly number: number; readonly text: string }[];
}

async function searchSkill(
  ctx: Context,
  skill: Skill,
  terms: readonly string[],
): Promise<SearchResult | null> {
  const files = await readTextFiles(librarySkillPath(ctx.paths, skill.name));
  const name = skill.name.toLowerCase();
  const description = skill.description.toLowerCase();

  let score = 0;
  for (const term of terms) {
    let termScore = 0;
    if (name.includes(term)) termScore += WEIGHT.name;
    if (description.includes(term)) termScore += WEIGHT.description;
    for (const file of files) {
      const count = file.lines.reduce((sum, line) => sum + countOf(line.text, term), 0);
      if (count === 0) continue;
      termScore +=
        file.path === SKILL_FILE
          ? WEIGHT.body + Math.min(count - 1, BODY_EXTRA_CAP)
          : WEIGHT.reference + Math.min(count - 1, REFERENCE_EXTRA_CAP);
    }
    if (termScore === 0) return null; // every term must match somewhere
    score += termScore;
  }

  return {
    name: skill.name,
    description: skill.description,
    score,
    matches: bestMatches(files, terms, skill.description),
  };
}

/** SKILL.md (without frontmatter) first, then every other text file, in path order. */
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
    const lines = file.content.split(/\r?\n/).map((line, index) => ({
      number: index + 1,
      text: line,
    }));
    text.push({
      path: file.path,
      lines: file.path === SKILL_FILE ? lines.slice(frontmatterLines(lines)) : lines,
    });
  }
  return text;
}

/** How many leading lines are YAML frontmatter (name and description are scored separately). */
function frontmatterLines(lines: readonly { text: string }[]): number {
  if (lines[0]?.text !== "---") return 0;
  const end = lines.findIndex((line, index) => index > 0 && line.text === "---");
  return end === -1 ? 0 : end + 1;
}

function countOf(text: string, term: string): number {
  const haystack = text.toLowerCase();
  let count = 0;
  for (let at = haystack.indexOf(term); at !== -1; at = haystack.indexOf(term, at + term.length)) {
    count++;
  }
  return count;
}

/**
 * The lines that best show why the skill matched: more distinct terms first,
 * then more occurrences, then SKILL.md before reference files, then file order.
 * A line that only repeats the description (shown with every result) is skipped.
 */
function bestMatches(
  files: readonly TextFile[],
  terms: readonly string[],
  description: string,
): SearchMatch[] {
  const candidates: { file: string; line: number; text: string; rank: number; order: number }[] =
    [];
  let order = 0;
  for (const file of files) {
    for (const line of file.lines) {
      order++;
      if (line.text.trim() === description) continue;
      const counts = terms.map((term) => countOf(line.text, term));
      const distinct = counts.filter((count) => count > 0).length;
      if (distinct === 0) continue;
      const occurrences = counts.reduce((sum, count) => sum + count, 0);
      const rank =
        distinct * 100 + Math.min(occurrences, 20) * 2 + (file.path === SKILL_FILE ? 1 : 0);
      candidates.push({ file: file.path, line: line.number, text: line.text, rank, order });
    }
  }
  return candidates
    .sort((a, b) => b.rank - a.rank || a.order - b.order)
    .slice(0, MAX_MATCHES)
    .map(({ file, line, text }) => ({ file, line, ...snippet(text, hitRanges(text, terms)) }));
}

/** Non-overlapping ranges of every term in `text`, in order. */
export function hitRanges(text: string, terms: readonly string[]): MatchRange[] {
  const haystack = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const term of terms) {
    for (let at = haystack.indexOf(term); at !== -1; at = haystack.indexOf(term, at + 1)) {
      ranges.push([at, at + term.length]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

/**
 * About `length` characters of `line` centred on its hits (or the first hit, if
 * they don't fit), cut at word boundaries where possible, with `…` marking each
 * cut. Returned ranges are relative to the snippet; hits cut off are dropped.
 */
export function snippet(
  line: string,
  ranges: readonly MatchRange[],
  length = SNIPPET_LENGTH,
): { snippet: string; ranges: MatchRange[] } {
  const indent = line.length - line.trimStart().length;
  const text = line.trim();
  const hits = ranges
    .map(([start, end]): MatchRange => [start - indent, end - indent])
    .filter(([start, end]) => start >= 0 && end <= text.length);
  if (text.length <= length) return { snippet: text, ranges: hits };

  const first = hits[0] ?? [0, 0];
  const last = hits.findLast(([, end]) => end - first[0] <= length) ?? first;
  const centre = Math.floor((first[0] + last[1]) / 2);
  let start = Math.max(0, Math.min(centre - Math.floor(length / 2), text.length - length));
  let end = start + length;
  // Prefer cutting at a space, unless that would cut a hit.
  const space = text.indexOf(" ", start);
  if (start > 0 && space !== -1 && space < first[0] && space - start < 15) start = space + 1;
  const back = text.lastIndexOf(" ", end);
  if (end < text.length && back > last[1] && end - back < 15) end = back;
  while (start < first[0] && text[start] === " ") start++;

  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return {
    snippet: `${prefix}${text.slice(start, end).trimEnd()}${suffix}`,
    ranges: hits
      .filter(([hitStart, hitEnd]) => hitStart >= start && hitEnd <= end)
      .map(([hitStart, hitEnd]) => [
        hitStart - start + prefix.length,
        hitEnd - start + prefix.length,
      ]),
  };
}
