import type { ContentState, DueState, RevisionHash } from "./types.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntil(due: Date, now: Date): number {
  return Math.ceil((due.getTime() - now.getTime()) / DAY_MS);
}

export function dueState(due: Date, now: Date, dueSoonDays: number): DueState {
  if (due.getTime() <= now.getTime()) return "overdue";
  return daysUntil(due, now) <= dueSoonDays ? "due-soon" : "active";
}

export interface ContentHashes {
  /** Revision the project borrowed. */
  readonly base: RevisionHash;
  /** Library's latest revision of the skill. */
  readonly head: RevisionHash;
  /** Hash of each target copy on disk; `null` when that copy is absent. */
  readonly working: readonly (RevisionHash | null)[];
}

/**
 * Local edits take precedence over missing copies: `missing` means some copies are
 * gone and every remaining copy is unmodified, so restoring them loses nothing.
 */
export function contentState({ base, head, working }: ContentHashes): ContentState {
  const present = working.filter((hash) => hash !== null);
  const modified = present.some((hash) => hash !== base);
  const behind = head !== base;
  if (modified) return behind ? "diverged" : "modified";
  if (present.length < working.length || working.length === 0) return "missing";
  return behind ? "behind" : "current";
}

/** True when the project copy carries no edits of its own and may be replaced safely. */
export function isClean(state: ContentState): boolean {
  return state === "current" || state === "behind" || state === "missing";
}
