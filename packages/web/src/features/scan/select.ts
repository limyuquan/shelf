import type { AdoptResult, FoundCopy, ScanGroup, ScanVariant } from "../../api/types.ts";
import type { Tone } from "../../components/ui/status.tsx";

/**
 * Pure helpers for the Find existing skills page: path display, which copies
 * can be selected, and the order they are adopted in. Unit-tested.
 */

/** `/home/me/code/app` → `~/code/app`. */
export function tildePath(path: string, home: string): string {
  if (path === home) return "~";
  return path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}

/** The reverse, for what the user types: `~/code` → `/home/me/code`. */
export function expandTilde(input: string, home: string): string {
  if (input === "~") return home;
  return input.startsWith("~/") ? `${home}${input.slice(1)}` : input;
}

/** A copy's project (`~/code/app`) and where in it the copy sits (`/.claude/skills/review`). */
export function copyLabel(copy: FoundCopy, home: string): { project: string; rest: string } {
  if (!copy.root) return { project: tildePath(copy.path, home), rest: "" };
  return { project: tildePath(copy.root, home), rest: copy.path.slice(copy.root.length) };
}

/** Copies shelf doesn't manage yet: the only ones that can be adopted. */
export function unmanagedPaths(group: ScanGroup): string[] {
  return group.variants.flatMap((variant) =>
    variant.copies.filter((copy) => !copy.managed).map((copy) => copy.path),
  );
}

export function managedCount(group: ScanGroup): number {
  return group.copies - unmanagedPaths(group).length;
}

/** Groups with something left to adopt come first; otherwise the scan's order. */
export function sortGroups(groups: readonly ScanGroup[]): ScanGroup[] {
  return [...groups].sort(
    (a, b) => Number(unmanagedPaths(b).length > 0) - Number(unmanagedPaths(a).length > 0),
  );
}

/** How much of a group's adoptable copies are selected, for its checkbox. */
export function groupSelection(
  group: ScanGroup,
  selected: ReadonlySet<string>,
): "all" | "some" | "none" {
  const paths = unmanagedPaths(group);
  const count = paths.filter((path) => selected.has(path)).length;
  if (count === 0) return "none";
  return count === paths.length ? "all" : "some";
}

/** Adds or removes items (copy paths, expanded group names) from a set. */
export function toggleItems(
  set: ReadonlySet<string>,
  items: readonly string[],
  on: boolean,
): Set<string> {
  const next = new Set(set);
  for (const item of items) {
    if (on) next.add(item);
    else next.delete(item);
  }
  return next;
}

/** The selection limited to copies that can still be adopted (e.g. after a rescan). */
export function pruneSelection(
  selected: ReadonlySet<string>,
  groups: readonly ScanGroup[],
): Set<string> {
  const adoptable = new Set(groups.flatMap(unmanagedPaths));
  return new Set([...selected].filter((path) => adoptable.has(path)));
}

/**
 * The selected paths in the order to adopt them. The first copy of a skill the
 * library lacks becomes the library version, so each group starts with its
 * library-latest version, then the most common (the scan's order).
 */
export function adoptionOrder(
  groups: readonly ScanGroup[],
  selected: ReadonlySet<string>,
): string[] {
  return groups.flatMap((group) =>
    [...group.variants]
      .sort((a, b) => Number(b.isLibraryLatest) - Number(a.isLibraryLatest))
      .flatMap((variant) => variant.copies.map((copy) => copy.path))
      .filter((path) => selected.has(path)),
  );
}

/** How a version relates to the library, if it is in it. */
export function versionLabel(variant: ScanVariant): { label: string; tone: Tone } | null {
  if (variant.isLibraryLatest) return { label: "library latest", tone: "green" };
  if (variant.inLibraryHistory) return { label: "old library revision", tone: "blue" };
  return null;
}

/** What adopting did to the library, per copy. */
export const ADOPTED: Record<AdoptResult["library"], { label: string; tone: Tone; help: string }> =
  {
    imported: { label: "Imported", tone: "green", help: "New to the library: this copy became it" },
    matched: { label: "Matched", tone: "green", help: "Same as the library's latest revision" },
    older: {
      label: "Older",
      tone: "blue",
      help: "An earlier version: updating the loan brings it up to date",
    },
    differs: {
      label: "Differs",
      tone: "orange",
      help: "Kept as local edits: review them, then promote or discard",
    },
  };

/** "Adopted 3 copies" and "1 imported · 2 matched", for the toast and the results. */
export function summarizeAdopt(results: readonly AdoptResult[]): {
  title: string;
  detail: string;
} {
  const counts = (Object.keys(ADOPTED) as AdoptResult["library"][])
    .map((kind) => [kind, results.filter((result) => result.library === kind).length] as const)
    .filter(([, count]) => count > 0);
  return {
    title: `Adopted ${results.length} cop${results.length === 1 ? "y" : "ies"}`,
    detail: counts.map(([kind, count]) => `${count} ${kind}`).join(" · "),
  };
}

export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;
