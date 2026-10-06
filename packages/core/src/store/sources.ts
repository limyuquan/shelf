import type { RevisionHash } from "../domain/types.ts";
import type { Db } from "./database.ts";

/** Where an imported skill came from, so `shelf pull` can fetch it again. */
export interface SkillSource {
  readonly skillId: number;
  readonly url: string;
  readonly ref: string | null;
  /** Skill directory inside the source, relative to its root. */
  readonly path: string | null;
  readonly commit: string | null;
  /** Library revision produced by the last import. */
  readonly revision: RevisionHash;
  readonly importedAt: Date;
}

interface SourceRow {
  skill_id: number;
  url: string;
  ref: string | null;
  path: string | null;
  commit_sha: string | null;
  revision: string;
  imported_at: string;
}

export function findSkillSource(db: Db, skillId: number): SkillSource | null {
  const row = db
    .query<SourceRow, [number]>("SELECT * FROM skill_sources WHERE skill_id = ?")
    .get(skillId);
  if (!row) return null;
  return {
    skillId: row.skill_id,
    url: row.url,
    ref: row.ref,
    path: row.path,
    commit: row.commit_sha,
    revision: row.revision,
    importedAt: new Date(row.imported_at),
  };
}

export function upsertSkillSource(db: Db, source: SkillSource): void {
  db.query(
    `INSERT INTO skill_sources (skill_id, url, ref, path, commit_sha, revision, imported_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(skill_id) DO UPDATE SET url = excluded.url, ref = excluded.ref,
       path = excluded.path, commit_sha = excluded.commit_sha, revision = excluded.revision,
       imported_at = excluded.imported_at`,
  ).run(
    source.skillId,
    source.url,
    source.ref,
    source.path,
    source.commit,
    source.revision,
    source.importedAt.toISOString(),
  );
}
