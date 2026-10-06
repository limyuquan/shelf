import type { Db } from "./database.ts";

export interface SkillSetRecord {
  readonly name: string;
  readonly description: string;
  readonly createdAt: Date;
  /** Member skill names, alphabetical. Archived skills are left out but stay members. */
  readonly skills: readonly string[];
}

interface SetRow {
  name: string;
  description: string;
  created_at: string;
}

function membersOf(db: Db, name: string): string[] {
  return db
    .query<{ name: string }, [string]>(
      `SELECT skills.name FROM skill_set_members
       JOIN skills ON skills.id = skill_set_members.skill_id
       WHERE skill_set_members.set_name = ? AND skills.archived_at IS NULL
       ORDER BY skills.name`,
    )
    .all(name)
    .map((row) => row.name);
}

const toSet = (db: Db, row: SetRow): SkillSetRecord => ({
  name: row.name,
  description: row.description,
  createdAt: new Date(row.created_at),
  skills: membersOf(db, row.name),
});

export function listSkillSets(db: Db): SkillSetRecord[] {
  return db
    .query<SetRow, []>("SELECT * FROM skill_sets ORDER BY name")
    .all()
    .map((row) => toSet(db, row));
}

export function findSkillSet(db: Db, name: string): SkillSetRecord | null {
  const row = db.query<SetRow, [string]>("SELECT * FROM skill_sets WHERE name = ?").get(name);
  return row ? toSet(db, row) : null;
}

/** Creates the set or replaces its description and members. Call inside a transaction. */
export function upsertSkillSet(
  db: Db,
  set: { name: string; description: string; at: Date },
  skillIds: readonly number[],
): void {
  db.query(
    `INSERT INTO skill_sets (name, description, created_at) VALUES (?, ?, ?)
     ON CONFLICT (name) DO UPDATE SET description = excluded.description`,
  ).run(set.name, set.description, set.at.toISOString());
  db.query("DELETE FROM skill_set_members WHERE set_name = ?").run(set.name);
  const insert = db.query(
    "INSERT OR IGNORE INTO skill_set_members (set_name, skill_id) VALUES (?, ?)",
  );
  for (const id of skillIds) insert.run(set.name, id);
}

/** Deletes a set and its memberships; false when there was no such set. */
export function deleteSkillSet(db: Db, name: string): boolean {
  return db.query("DELETE FROM skill_sets WHERE name = ?").run(name).changes > 0;
}
