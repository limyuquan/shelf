import type { AttentionReason, ContentState, DueState } from "../../api/types.ts";
import type { Tone } from "../../components/ui/status.tsx";

/** How each state is shown. One table, so every view describes states the same way. */
export const CONTENT: Record<ContentState, { label: string; tone: Tone; help: string }> = {
  current: { label: "Up to date", tone: "green", help: "Matches the library's latest revision" },
  behind: { label: "Behind", tone: "blue", help: "The library has a newer revision" },
  modified: { label: "Edited", tone: "orange", help: "The project copy has local edits" },
  diverged: { label: "Diverged", tone: "red", help: "Edited here and in the library" },
  missing: { label: "Missing", tone: "red", help: "The project copy was deleted" },
};

export const DUE: Record<DueState, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "neutral" },
  "due-soon": { label: "Due soon", tone: "yellow" },
  overdue: { label: "Overdue", tone: "red" },
};

export const REASON: Record<AttentionReason, { title: string; tone: Tone }> = {
  overdue: { title: "Overdue", tone: "red" },
  diverged: { title: "Diverged", tone: "red" },
  modified: { title: "Edited in a project", tone: "orange" },
  missing: { title: "Missing copies", tone: "red" },
  "due-soon": { title: "Due soon", tone: "yellow" },
  behind: { title: "Updates available", tone: "blue" },
};
