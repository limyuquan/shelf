/** Pure helpers for showing search hits: highlighting, labels, links and short snippets. */

/** A `[start, end)` range of a hit within a snippet. */
export type Range = readonly [number, number];

export interface Part {
  readonly text: string;
  readonly hit: boolean;
}

const SKILL_FILE = "SKILL.md";

/**
 * Splits `text` into plain and highlighted parts. Ranges may arrive unsorted,
 * overlapping or out of bounds; empty parts are dropped.
 */
export function highlightParts(text: string, ranges: readonly Range[]): Part[] {
  const sorted = ranges
    .map(([start, end]): Range => [Math.max(0, start), Math.min(text.length, end)])
    .filter(([start, end]) => start < end)
    .sort((a, b) => a[0] - b[0]);
  const parts: Part[] = [];
  let at = 0;
  for (const [start, end] of sorted) {
    if (end <= at) continue;
    const from = Math.max(start, at);
    if (from > at) parts.push({ text: text.slice(at, from), hit: false });
    parts.push({ text: text.slice(from, end), hit: true });
    at = end;
  }
  if (at < text.length) parts.push({ text: text.slice(at), hit: false });
  return parts;
}

/** Where a hit is, for reference files only: `errors.md:12`. SKILL.md hits need no label. */
export function matchLocation(match: { file: string; line: number }): string | null {
  if (match.file === SKILL_FILE) return null;
  return `${match.file.split("/").at(-1)}:${match.line}`;
}

/** The skill page's search params that open the file a hit is in. */
export function matchSearch(match: { file: string }): { file?: string } {
  return match.file === SKILL_FILE ? {} : { file: match.file };
}

/**
 * Shortens a snippet to about `max` characters around its first hit (for the ⌘K
 * menu), keeping the ranges that still fit and marking cuts with `…`.
 */
export function shortSnippet(
  snippet: string,
  ranges: readonly Range[],
  max = 60,
): { snippet: string; ranges: Range[] } {
  if (snippet.length <= max) return { snippet, ranges: [...ranges] };
  const [first] = [...ranges].sort((a, b) => a[0] - b[0]);
  const hit = first ?? [0, 0];
  // Some context before the hit, but never so much that the hit is cut off.
  const lead = Math.min(Math.floor(max / 3), Math.max(0, max - (hit[1] - hit[0])));
  let start = Math.max(0, Math.min(hit[0] - lead, snippet.length - max));
  let end = Math.min(snippet.length, start + max);
  // An ellipsis already at the cut is reused rather than doubled.
  if (snippet[start] === "…") start++;
  if (snippet[end - 1] === "…") end--;
  const prefix = start > 0 ? "…" : "";
  const suffix = end < snippet.length ? "…" : "";
  return {
    snippet: `${prefix}${snippet.slice(start, end).trim()}${suffix}`,
    ranges: ranges
      .filter(([s, e]) => s >= start && e <= end)
      .map(([s, e]): Range => {
        const shift = prefix.length - start - leadingSpace(snippet, start, end);
        return [s + shift, e + shift];
      }),
  };
}

function leadingSpace(text: string, start: number, end: number): number {
  const slice = text.slice(start, end);
  return slice.length - slice.trimStart().length;
}
