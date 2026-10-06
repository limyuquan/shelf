import type { Database } from "bun:sqlite";

/**
 * Append-only list of schema migrations. Position N (1-based) is applied when
 * `PRAGMA user_version` < N. Never edit a shipped migration; add a new one.
 */
const MIGRATIONS: readonly string[] = [
  /* 1: initial schema */ `
  CREATE TABLE projects (
    id           TEXT PRIMARY KEY,
    path         TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  );

  CREATE TABLE skills (
    id              INTEGER PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    description     TEXT NOT NULL,
    latest_revision TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    archived_at     TEXT
  );

  CREATE TABLE revisions (
    skill_id   INTEGER NOT NULL REFERENCES skills(id),
    hash       TEXT NOT NULL,
    parent     TEXT,
    source     TEXT NOT NULL CHECK (source IN ('library', 'promote')),
    created_at TEXT NOT NULL,
    PRIMARY KEY (skill_id, hash)
  );

  CREATE TABLE loans (
    id          INTEGER PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    skill_id    INTEGER NOT NULL REFERENCES skills(id),
    revision    TEXT NOT NULL,
    targets     TEXT NOT NULL,
    policy      TEXT NOT NULL CHECK (policy IN ('pinned', 'follow')),
    borrowed_at TEXT NOT NULL,
    due_at      TEXT NOT NULL,
    returned_at TEXT
  );
  CREATE UNIQUE INDEX loans_one_active_per_skill ON loans(project_id, skill_id) WHERE returned_at IS NULL;
  CREATE INDEX loans_active_due ON loans(due_at) WHERE returned_at IS NULL;

  CREATE TABLE events (
    id         INTEGER PRIMARY KEY,
    at         TEXT NOT NULL,
    actor      TEXT NOT NULL,
    type       TEXT NOT NULL,
    project_id TEXT,
    skill_id   INTEGER,
    detail     TEXT
  );
  CREATE INDEX events_at ON events(at);
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export function migrate(db: Database): void {
  const current = db.query<{ user_version: number }, []>("PRAGMA user_version").get()?.user_version;
  for (let version = (current ?? 0) + 1; version <= MIGRATIONS.length; version++) {
    const sql = MIGRATIONS[version - 1] as string;
    db.transaction(() => {
      db.run(sql);
      db.run(`PRAGMA user_version = ${version}`);
    }).immediate();
  }
}
