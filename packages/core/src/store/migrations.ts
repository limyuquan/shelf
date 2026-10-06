import type { Database } from "bun:sqlite";

/**
 * Append-only list of schema migrations. Position N (1-based) is applied when
 * `PRAGMA user_version` < N. Never edit a shipped migration; add a new one.
 */
export const MIGRATIONS: readonly string[] = [
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

  /* 2: imported skills, link mode */ `
  -- SQLite cannot alter a CHECK constraint, so rebuild revisions to allow 'import'.
  CREATE TABLE revisions_v2 (
    skill_id   INTEGER NOT NULL REFERENCES skills(id),
    hash       TEXT NOT NULL,
    parent     TEXT,
    source     TEXT NOT NULL CHECK (source IN ('library', 'promote', 'import')),
    created_at TEXT NOT NULL,
    PRIMARY KEY (skill_id, hash)
  );
  INSERT INTO revisions_v2 (skill_id, hash, parent, source, created_at)
    SELECT skill_id, hash, parent, source, created_at FROM revisions;
  DROP TABLE revisions;
  ALTER TABLE revisions_v2 RENAME TO revisions;

  ALTER TABLE loans ADD COLUMN mode TEXT NOT NULL DEFAULT 'copy' CHECK (mode IN ('copy', 'link'));

  CREATE TABLE skill_sources (
    skill_id    INTEGER PRIMARY KEY REFERENCES skills(id),
    url         TEXT NOT NULL,
    ref         TEXT,
    path        TEXT,
    commit_sha  TEXT,
    revision    TEXT NOT NULL,
    imported_at TEXT NOT NULL
  );
  `,

  /* 3: usage tracking, adopted older revisions */ `
  ALTER TABLE loans ADD COLUMN last_used_at TEXT;

  -- Allow 'adopt': an older, unedited version found in a project during adoption.
  CREATE TABLE revisions_v3 (
    skill_id   INTEGER NOT NULL REFERENCES skills(id),
    hash       TEXT NOT NULL,
    parent     TEXT,
    source     TEXT NOT NULL CHECK (source IN ('library', 'promote', 'import', 'adopt')),
    created_at TEXT NOT NULL,
    PRIMARY KEY (skill_id, hash)
  );
  INSERT INTO revisions_v3 (skill_id, hash, parent, source, created_at)
    SELECT skill_id, hash, parent, source, created_at FROM revisions;
  DROP TABLE revisions;
  ALTER TABLE revisions_v3 RENAME TO revisions;
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export function migrate(db: Database): void {
  const version = () =>
    db.query<{ user_version: number }, []>("PRAGMA user_version").get()?.user_version ?? 0;
  if (version() >= MIGRATIONS.length) return;
  // Re-read the version under the write lock: concurrent processes opening a new
  // database must not both apply the same migration.
  db.transaction(() => {
    for (let next = version() + 1; next <= MIGRATIONS.length; next++) {
      db.run(MIGRATIONS[next - 1] as string);
      db.run(`PRAGMA user_version = ${next}`);
    }
  }).immediate();
}
