import type { Loan, LoanPolicy, RevisionHash } from "../domain/types.ts";
import type { Db } from "./database.ts";

interface LoanRow {
  id: number;
  project_id: string;
  skill_id: number;
  skill_name: string;
  revision: string;
  targets: string;
  policy: LoanPolicy;
  borrowed_at: string;
  due_at: string;
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
  borrowedAt: new Date(row.borrowed_at),
  dueAt: new Date(row.due_at),
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
    borrowedAt: Date;
    dueAt: Date;
  },
): void {
  db.query(
    `INSERT INTO loans (project_id, skill_id, revision, targets, policy, borrowed_at, due_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    loan.projectId,
    loan.skillId,
    loan.revision,
    JSON.stringify(loan.targets),
    loan.policy,
    loan.borrowedAt.toISOString(),
    loan.dueAt.toISOString(),
  );
}

export function setLoanRevision(db: Db, loanId: number, revision: RevisionHash): void {
  db.query("UPDATE loans SET revision = ? WHERE id = ?").run(revision, loanId);
}

export function setLoanDue(db: Db, loanId: number, dueAt: Date): void {
  db.query("UPDATE loans SET due_at = ? WHERE id = ?").run(dueAt.toISOString(), loanId);
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
