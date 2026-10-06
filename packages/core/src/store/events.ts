import type { Actor, EventType } from "../domain/types.ts";
import type { Db } from "./database.ts";

export interface ShelfEvent {
  readonly type: EventType;
  readonly actor: Actor;
  readonly at: Date;
  readonly projectId?: string;
  readonly skillId?: number;
  readonly detail?: Record<string, unknown>;
}

/** Appends to the audit log. Events are never updated or deleted. */
export function recordEvent(db: Db, event: ShelfEvent): void {
  db.query(
    "INSERT INTO events (at, actor, type, project_id, skill_id, detail) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    event.at.toISOString(),
    event.actor,
    event.type,
    event.projectId ?? null,
    event.skillId ?? null,
    event.detail ? JSON.stringify(event.detail) : null,
  );
}
