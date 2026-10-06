import { pathExists } from "../library/fs.ts";
import { listProjects } from "../store/projects.ts";
import type { Context } from "./context.ts";
import { inspectLoans, type LoanReport } from "./inspect.ts";
import { refreshLibrary } from "./library.ts";

/** Why a loan needs the user's (or an agent's) attention, most urgent first. */
export type AttentionReason =
  | "overdue"
  | "diverged"
  | "modified"
  | "missing"
  | "due-soon"
  | "behind";

const URGENCY: readonly AttentionReason[] = [
  "overdue",
  "diverged",
  "modified",
  "missing",
  "due-soon",
  "behind",
];

export interface AttentionItem extends LoanReport {
  readonly project: { readonly id: string; readonly name: string; readonly path: string };
  /** Every reason that applies, most urgent first. */
  readonly reasons: AttentionReason[];
}

/**
 * Loans across all projects that need action: due soon or overdue, edited, missing,
 * or behind the library. Read-only — unlike `status`, nothing is returned or fixed.
 */
export async function listAttention(ctx: Context): Promise<AttentionItem[]> {
  await refreshLibrary(ctx);
  const items: AttentionItem[] = [];
  for (const project of listProjects(ctx.db)) {
    if (!(await pathExists(project.path))) continue;
    for (const { report } of await inspectLoans(ctx, project)) {
      const reasons = reasonsFor(report);
      if (reasons.length === 0) continue;
      items.push({
        ...report,
        project: { id: project.id, name: project.name, path: project.path },
        reasons,
      });
    }
  }
  return items.sort(
    (a, b) =>
      URGENCY.indexOf(a.reasons[0] as AttentionReason) -
        URGENCY.indexOf(b.reasons[0] as AttentionReason) || a.daysLeft - b.daysLeft,
  );
}

function reasonsFor(loan: LoanReport): AttentionReason[] {
  const reasons = new Set<AttentionReason>();
  if (loan.due === "overdue" || loan.due === "due-soon") reasons.add(loan.due);
  if (loan.content !== "current") reasons.add(loan.content);
  return URGENCY.filter((reason) => reasons.has(reason));
}
