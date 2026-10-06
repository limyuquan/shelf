import type { Project } from "../domain/types.ts";
import type { Db } from "./database.ts";

interface ProjectRow {
  id: string;
  path: string;
  name: string;
  created_at: string;
  last_seen_at: string;
}

const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  path: row.path,
  name: row.name,
  createdAt: new Date(row.created_at),
  lastSeenAt: new Date(row.last_seen_at),
});

export function findProjectById(db: Db, id: string): Project | null {
  const row = db.query<ProjectRow, [string]>("SELECT * FROM projects WHERE id = ?").get(id);
  return row ? toProject(row) : null;
}

export function listProjects(db: Db): Project[] {
  return db.query<ProjectRow, []>("SELECT * FROM projects ORDER BY name").all().map(toProject);
}

/**
 * Inserts the project or refreshes its path and last-seen time. A project keeps its
 * id when its directory moves; any stale row still claiming the new path is dropped.
 */
export function upsertProject(db: Db, project: Project): void {
  db.query("DELETE FROM projects WHERE path = ? AND id != ?").run(project.path, project.id);
  db.query(
    `INSERT INTO projects (id, path, name, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET path = excluded.path, name = excluded.name,
                                   last_seen_at = excluded.last_seen_at`,
  ).run(
    project.id,
    project.path,
    project.name,
    project.createdAt.toISOString(),
    project.lastSeenAt.toISOString(),
  );
}
