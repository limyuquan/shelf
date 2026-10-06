import { type EventFilter, type EventRecord, listEvents } from "../store/events.ts";
import type { Context } from "./context.ts";

/** The activity log, newest first: borrows, renewals (with reasons), expiries, edits. */
export function activity(ctx: Context, options: Partial<EventFilter> = {}): EventRecord[] {
  return listEvents(ctx.db, {
    limit: options.limit ?? 100,
    ...(options.projectId ? { projectId: options.projectId } : {}),
    ...(options.skill ? { skill: options.skill } : {}),
  });
}
