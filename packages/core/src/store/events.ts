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

export interface EventRecord {
  readonly id: number;
  readonly at: Date;
  readonly actor: Actor;
  readonly type: EventType;
  readonly project: string | null;
  readonly skill: string | null;
  readonly detail: Record<string, unknown> | null;
}

interface EventRow {
  id: number;
  at: string;
  actor: string;
  type: EventType;
  project: string | null;
  skill: string | null;
  detail: string | null;
}

/** The newest events first, with project and skill names resolved. */
export function listEvents(db: Db, options: { limit: number; projectId?: string }): EventRecord[] {
  const where = options.projectId ? "WHERE events.project_id = ?" : "";
  const params = options.projectId ? [options.projectId, options.limit] : [options.limit];
  return db
    .query<EventRow, (string | number)[]>(
      `SELECT events.id, events.at, events.actor, events.type, events.detail,
              projects.name AS project, skills.name AS skill
       FROM events
       LEFT JOIN projects ON projects.id = events.project_id
       LEFT JOIN skills ON skills.id = events.skill_id
       ${where}
       ORDER BY events.id DESC LIMIT ?`,
    )
    .all(...params)
    .map((row) => ({
      id: row.id,
      at: new Date(row.at),
      actor: row.actor,
      type: row.type,
      project: row.project,
      skill: row.skill,
      detail: row.detail ? (JSON.parse(row.detail) as Record<string, unknown>) : null,
    }));
}
