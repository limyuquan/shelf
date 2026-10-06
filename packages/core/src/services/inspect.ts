import { contentState, daysUntil, dueState } from "../domain/loan-state.ts";
import type {
  ContentState,
  DueState,
  Loan,
  LoanPolicy,
  Project,
  RevisionHash,
  Skill,
} from "../domain/types.ts";
import { ShelfError } from "../errors.ts";
import { hashSkillCopies } from "../projection/materialize.ts";
import { findActiveLoan, listActiveLoans } from "../store/loans.ts";
import { findSkillByName } from "../store/skills.ts";
import type { Context } from "./context.ts";

/** The public, serialisable view of a loan. */
export interface LoanReport {
  readonly skill: string;
  readonly content: ContentState;
  readonly due: DueState;
  readonly dueAt: Date;
  readonly daysLeft: number;
  /** Last recorded use in this project; null if never seen (e.g. no harness hooks). */
  readonly lastUsedAt: Date | null;
  readonly policy: LoanPolicy;
  readonly revision: RevisionHash;
  readonly latestRevision: RevisionHash;
  readonly targets: readonly string[];
}

/** A loan together with everything needed to act on it. */
export interface LoanInspection {
  readonly loan: Loan;
  readonly skill: Skill;
  /** Hash of each target copy on disk, aligned with `loan.targets`. */
  readonly working: readonly (RevisionHash | null)[];
  readonly report: LoanReport;
}

async function inspectLoan(ctx: Context, project: Project, loan: Loan): Promise<LoanInspection> {
  const skill = findSkillByName(ctx.db, loan.skillName);
  if (!skill) throw new Error(`Loan ${loan.id} references missing skill ${loan.skillName}`);
  const now = ctx.clock.now();
  const working = await hashSkillCopies(project.path, loan.targets, loan.skillName);
  return {
    loan,
    skill,
    working,
    report: {
      skill: loan.skillName,
      content: contentState({ base: loan.revision, head: skill.latestRevision, working }),
      due: dueState(loan.dueAt, now, ctx.config.dueSoonDays),
      dueAt: loan.dueAt,
      daysLeft: daysUntil(loan.dueAt, now),
      lastUsedAt: loan.lastUsedAt,
      policy: loan.policy,
      revision: loan.revision,
      latestRevision: skill.latestRevision,
      targets: loan.targets,
    },
  };
}

export async function inspectLoans(ctx: Context, project: Project): Promise<LoanInspection[]> {
  return Promise.all(
    listActiveLoans(ctx.db, project.id).map((loan) => inspectLoan(ctx, project, loan)),
  );
}

export async function inspectBorrowedSkill(
  ctx: Context,
  project: Project,
  name: string,
): Promise<LoanInspection> {
  const loan = findActiveLoan(ctx.db, project.id, name);
  if (!loan) {
    throw new ShelfError(
      "NOT_BORROWED",
      `"${name}" is not borrowed by ${project.name}`,
      `Run \`shelf borrow ${name}\` first`,
    );
  }
  return inspectLoan(ctx, project, loan);
}
