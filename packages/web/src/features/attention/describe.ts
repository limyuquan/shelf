import type { AttentionItem } from "../../api/types.ts";

/** One line explaining why an item needs attention, from its most urgent reason. */
export function describeAttention(item: AttentionItem, now = Date.now()): string {
  const unused = item.lastUsedAt
    ? `Unused for ${Math.max(1, Math.floor((now - new Date(item.lastUsedAt).getTime()) / 86_400_000))} days`
    : "Never used since borrowed";
  switch (item.reasons[0]) {
    case "overdue": {
      // Expiry never discards edits (core `isClean`); otherwise the loan is
      // returned when the project next syncs (session start, status, sync, sweep).
      const overdue = `Overdue by ${-item.daysLeft} day${item.daysLeft === -1 ? "" : "s"}`;
      return item.content === "modified" || item.content === "diverged"
        ? `${overdue}, not returned because it has local edits`
        : `${overdue}, returned the next time shelf syncs the project`;
    }
    case "diverged":
      return "Edited in the project and in the library";
    case "modified":
      return "Edited in the project: promote the edits or discard them";
    case "missing":
      return "Project copies were deleted: syncing restores them";
    case "due-soon":
      return `${unused} · returned in ${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"} unless used`;
    case "behind":
      return "The library has a newer revision";
    default:
      return "";
  }
}
