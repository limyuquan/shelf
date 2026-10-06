import { type EventRecord, listEvents } from "../store/events.ts";
import type { Context } from "./context.ts";

/** The activity log, newest first: borrows, renewals (with reasons), expiries, edits. */
export function activity(
  ctx: Context,
  options: { limit?: number; projectId?: string } = {},
): EventRecord[] {
  return listEvents(ctx.db, {
    limit: options.limit ?? 100,
    ...(options.projectId ? { projectId: options.projectId } : {}),
  });
}
