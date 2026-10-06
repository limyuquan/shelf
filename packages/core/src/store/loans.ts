import type { Loan, LoanMode, LoanPolicy, RevisionHash } from "../domain/types.ts";
import type { Db } from "./database.ts";

interface LoanRow {
  id: number;
  project_id: string;
  skill_id: number;
  skill_name: string;
  revision: string;
  targets: string;
  policy: LoanPolicy;
  mode: LoanMode;
  borrowed_at: string;
  due_at: string;
  last_used_at: string | null;
  keep: number;
  returned_at: string | null;
}

const SELECT_LOAN = `
  SELECT loans.*, skills.name AS skill_name
  FROM loans JOIN skills ON skills.id = loans.skill_id`;

const toLoan = (row: LoanRow): Loan => ({
  id: row.id,
  projectId: row.project_id,
  skillId: row.skill_id,
  skillName: row.skill_name,
  revision: row.revision,
  targets: JSON.parse(row.targets) as string[],
  policy: row.policy,
  mode: row.mode,
  borrowedAt: new Date(row.borrowed_at),
  dueAt: new Date(row.due_at),
  lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
  keep: row.keep === 1,
  returnedAt: row.returned_at ? new Date(row.returned_at) : null,
});

export function listActiveLoans(db: Db, projectId: string): Loan[] {
  return db
    .query<LoanRow, [string]>(
      `${SELECT_LOAN} WHERE loans.project_id = ? AND loans.returned_at IS NULL ORDER BY skills.name`,
    )
    .all(projectId)
    .map(toLoan);
}

export function findActiveLoan(db: Db, projectId: string, skillName: string): Loan | null {
  const row = db
    .query<LoanRow, [string, string]>(
      `${SELECT_LOAN} WHERE loans.project_id = ? AND skills.name = ? AND loans.returned_at IS NULL`,
    )
    .get(projectId, skillName);
  return row ? toLoan(row) : null;
}

export function insertLoan(
  db: Db,
  loan: {
    projectId: string;
    skillId: number;
    revision: RevisionHash;
    targets: readonly string[];
    policy: LoanPolicy;
    mode?: LoanMode;
    keep?: boolean;
    borrowedAt: Date;
    dueAt: Date;
  },
): void {
  db.query(
    `INSERT INTO loans (project_id, skill_id, revision, targets, policy, mode, keep, borrowed_at, due_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    loan.projectId,
    loan.skillId,
    loan.revision,
    JSON.stringify(loan.targets),
    loan.policy,
    loan.mode ?? "copy",
    loan.keep ? 1 : 0,
    loan.borrowedAt.toISOString(),
    loan.dueAt.toISOString(),
  );
}

export function setLoanRevision(db: Db, loanId: number, revision: RevisionHash): void {
  db.query("UPDATE loans SET revision = ? WHERE id = ?").run(revision, loanId);
}

export function setLoanTargets(db: Db, loanId: number, targets: readonly string[]): void {
  db.query("UPDATE loans SET targets = ? WHERE id = ?").run(JSON.stringify(targets), loanId);
}

export function setLoanDue(db: Db, loanId: number, dueAt: Date): void {
  db.query("UPDATE loans SET due_at = ? WHERE id = ?").run(dueAt.toISOString(), loanId);
}

/** Records a use of the skill and, when it moves, the slid due date. */
export function setLoanUsed(db: Db, loanId: number, usedAt: Date, dueAt: Date): void {
  db.query("UPDATE loans SET last_used_at = ?, due_at = ? WHERE id = ?").run(
    usedAt.toISOString(),
    dueAt.toISOString(),
    loanId,
  );
}

/** Marks a loan kept (never due) or not, with the due date it has from then on. */
export function setLoanKeep(db: Db, loanId: number, keep: boolean, dueAt: Date): void {
  db.query("UPDATE loans SET keep = ?, due_at = ? WHERE id = ?").run(
    keep ? 1 : 0,
    dueAt.toISOString(),
    loanId,
  );
}

export function closeLoan(db: Db, loanId: number, at: Date): void {
  db.query("UPDATE loans SET returned_at = ? WHERE id = ?").run(at.toISOString(), loanId);
}

/** Active loans of one skill across all projects. */
export function listActiveLoansForSkill(db: Db, skillId: number): Loan[] {
  return db
    .query<LoanRow, [number]>(
      `${SELECT_LOAN} WHERE loans.skill_id = ? AND loans.returned_at IS NULL ORDER BY loans.project_id`,
    )
    .all(skillId)
    .map(toLoan);
}

/** Base revisions of every active loan, across all projects. */
export function listActiveLoanRevisions(db: Db): Set<RevisionHash> {
  const rows = db
    .query<{ revision: string }, []>(
      "SELECT DISTINCT revision FROM loans WHERE returned_at IS NULL",
    )
    .all();
  return new Set(rows.map((row) => row.revision));
}

export interface SkillLoanStats {
  /** Active loans across all projects. */
  readonly borrowers: number;
  /**
   * Latest use over every loan of the skill, returned ones included, or the latest
   * `loan.used` event (events outlive the loans of forgotten projects).
   */
  readonly lastUsedAt: Date | null;
}

/** Borrower counts and last use of every skill that has ever been borrowed or used. */
export function listSkillLoanStats(db: Db): Map<number, SkillLoanStats> {
  const rows = db
    .query<{ skill_id: number; borrowers: number; last_used_at: string | null }, []>(
      `SELECT skill_id, SUM(borrowers) AS borrowers, MAX(last_used_at) AS last_used_at FROM (
         SELECT skill_id, SUM(returned_at IS NULL) AS borrowers, MAX(last_used_at) AS last_used_at
         FROM loans GROUP BY skill_id
         UNION ALL
         SELECT skill_id, 0, MAX(at) FROM events
         WHERE type = 'loan.used' AND skill_id IS NOT NULL GROUP BY skill_id
       ) GROUP BY skill_id`,
    )
    .all();
  return new Map(
    rows.map((row) => [
      row.skill_id,
      {
        borrowers: row.borrowers,
        lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
      },
    ]),
  );
}
