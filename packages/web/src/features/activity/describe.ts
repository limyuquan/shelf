import type { ActivityEvent } from "../../api/types.ts";
import { actorLabel, shortHash, sourceLabel } from "../../lib/format.ts";

/**
 * Consecutive events of the same kind by the same actor in the same project,
 * within a minute — e.g. adopting six skills at once — shown as one entry.
 */
export interface EventGroup {
  readonly key: string;
  readonly type: ActivityEvent["type"];
  readonly actor: string;
  readonly at: string;
  readonly project: string | null;
  readonly projectId: string | null;
  readonly skills: string[];
  readonly events: ActivityEvent[];
}

const WINDOW_MS = 60_000;

export function groupEvents(events: readonly ActivityEvent[]): EventGroup[] {
  const groups: EventGroup[] = [];
  for (const event of events) {
    const last = groups.at(-1);
    const sameBatch =
      last &&
      last.type === event.type &&
      last.actor === event.actor &&
      last.projectId === event.projectId &&
      new Date(last.events.at(-1)?.at ?? last.at).getTime() - new Date(event.at).getTime() <
        WINDOW_MS;
    if (last && sameBatch) {
      last.events.push(event);
      if (event.skill && !last.skills.includes(event.skill)) last.skills.push(event.skill);
      continue;
    }
    groups.push({
      key: String(event.id),
      type: event.type,
      actor: event.actor,
      at: event.at,
      project: event.project,
      projectId: event.projectId,
      skills: event.skill ? [event.skill] : [],
      events: [event],
    });
  }
  return groups;
}

/** The verb phrase for a group: "{actor} {verb} {skills} {preposition} {project}". */
export function describeGroup(group: EventGroup): {
  actor: string;
  verb: string;
  preposition: string | null;
  detail: string | null;
} {
  const first = group.events[0];
  const detail = first?.detail ?? {};
  const reason = typeof detail.reason === "string" ? detail.reason : null;
  const base = { actor: actorLabel(group.actor), detail: reason };
  switch (group.type) {
    case "loan.borrowed":
      return { ...base, verb: "borrowed", preposition: "into" };
    case "loan.adopted":
      return { ...base, verb: "adopted", preposition: "in" };
    case "loan.used":
      return { ...base, verb: "used", preposition: "in" };
    case "loan.due-changed":
      return { ...base, verb: reason ? "renewed" : "moved the due date of", preposition: "in" };
    case "loan.updated":
      return { ...base, verb: "updated", preposition: "in" };
    case "loan.restored":
      return { ...base, verb: "restored", preposition: "in" };
    case "loan.returned":
      return { ...base, verb: "returned", preposition: "from" };
    case "loan.expired":
      return { ...base, verb: "returned unused", preposition: "from" };
    case "loan.detached":
      return { ...base, verb: "detached", preposition: "in" };
    case "skill.created":
      return { ...base, verb: "added", preposition: null, detail: "to the library" };
    case "skill.revised":
      return typeof detail.restoredFrom === "string"
        ? {
            ...base,
            verb: "restored",
            preposition: null,
            detail: `to rev ${shortHash(detail.restoredFrom)}`,
          }
        : { ...base, verb: "revised", preposition: null };
    case "skill.archived":
      return { ...base, verb: "archived", preposition: null };
    case "skill.linked":
      return {
        ...base,
        verb: "linked",
        preposition: null,
        detail: typeof detail.source === "string" ? `to ${sourceLabel(detail.source)}` : null,
      };
    case "project.registered":
      return { ...base, verb: "started using shelf", preposition: "in" };
    case "project.forgotten":
      return { ...base, verb: "forgot", preposition: null };
    default:
      return { ...base, verb: group.type, preposition: null };
  }
}

/** "Today", "Yesterday", or a date: the heading for a day's entries. */
export function dayLabel(iso: string, now = new Date()): string {
  const day = new Date(iso);
  const startOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((startOf(now).getTime() - startOf(day).getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return day.toLocaleDateString("en", {
    weekday: days < 7 ? "long" : undefined,
    month: "short",
    day: "numeric",
    ...(day.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}
