import type { RevisionHash, RevisionSource, Skill } from "../domain/types.ts";
import type { Db } from "./database.ts";

interface SkillRow {
  id: number;
  name: string;
  description: string;
  latest_revision: string;
  created_at: string;
  archived_at: string | null;
}

const toSkill = (row: SkillRow): Skill => ({
  id: row.id,
  name: row.name,
  description: row.description,
  latestRevision: row.latest_revision,
  createdAt: new Date(row.created_at),
  archivedAt: row.archived_at ? new Date(row.archived_at) : null,
});

export function findSkillByName(db: Db, name: string): Skill | null {
  const row = db.query<SkillRow, [string]>("SELECT * FROM skills WHERE name = ?").get(name);
  return row ? toSkill(row) : null;
}

export function listSkills(db: Db, { includeArchived = false } = {}): Skill[] {
  const where = includeArchived ? "" : "WHERE archived_at IS NULL";
  return db.query<SkillRow, []>(`SELECT * FROM skills ${where} ORDER BY name`).all().map(toSkill);
}

export function insertSkill(
  db: Db,
  skill: { name: string; description: string; revision: RevisionHash; at: Date },
): Skill {
  const row = db
    .query<SkillRow, [string, string, string, string]>(
      `INSERT INTO skills (name, description, latest_revision, created_at)
       VALUES (?, ?, ?, ?) RETURNING *`,
    )
    .get(skill.name, skill.description, skill.revision, skill.at.toISOString());
  if (!row) throw new Error(`Failed to insert skill ${skill.name}`);
  return toSkill(row);
}

export function updateSkillHead(
  db: Db,
  id: number,
  head: { description: string; revision: RevisionHash },
): void {
  db.query(
    "UPDATE skills SET description = ?, latest_revision = ?, archived_at = NULL WHERE id = ?",
  ).run(head.description, head.revision, id);
}

export function archiveSkill(db: Db, id: number, at: Date): void {
  db.query("UPDATE skills SET archived_at = ? WHERE id = ?").run(at.toISOString(), id);
}

export function insertRevision(
  db: Db,
  revision: {
    skillId: number;
    hash: RevisionHash;
    parent: RevisionHash | null;
    source: RevisionSource;
    at: Date;
  },
): void {
  db.query(
    `INSERT OR IGNORE INTO revisions (skill_id, hash, parent, source, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    revision.skillId,
    revision.hash,
    revision.parent,
    revision.source,
    revision.at.toISOString(),
  );
}

export function countRevisions(db: Db, skillId: number): number {
  return (
    db
      .query<{ n: number }, [number]>("SELECT COUNT(*) AS n FROM revisions WHERE skill_id = ?")
      .get(skillId)?.n ?? 0
  );
}
