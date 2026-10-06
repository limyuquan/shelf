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
  readonly projectId: string | null;
  readonly project: string | null;
  readonly skill: string | null;
  readonly detail: Record<string, unknown> | null;
}

export interface EventFilter {
  readonly limit: number;
  readonly projectId?: string;
  readonly skill?: string;
}

interface EventRow {
  id: number;
  at: string;
  actor: string;
  type: EventType;
  project_id: string | null;
  project: string | null;
  skill: string | null;
  detail: string | null;
}

/** The newest events first, with project and skill names resolved. */
export function listEvents(db: Db, options: EventFilter): EventRecord[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (options.projectId) {
    conditions.push("events.project_id = ?");
    params.push(options.projectId);
  }
  if (options.skill) {
    conditions.push("skills.name = ?");
    params.push(options.skill);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(options.limit);
  return db
    .query<EventRow, (string | number)[]>(
      `SELECT events.id, events.at, events.actor, events.type, events.detail,
              events.project_id, projects.name AS project, skills.name AS skill
       FROM events
       LEFT JOIN projects ON projects.id = events.project_id
       LEFT JOIN skills ON skills.id = events.skill_id
       ${where}
       ORDER BY events.at DESC, events.id DESC LIMIT ?`,
    )
    .all(...params)
    .map((row) => ({
      id: row.id,
      at: new Date(row.at),
      actor: row.actor,
      type: row.type,
      projectId: row.project_id,
      project: row.project,
      skill: row.skill,
      detail: row.detail ? (JSON.parse(row.detail) as Record<string, unknown>) : null,
    }));
}
