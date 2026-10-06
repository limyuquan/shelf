import type { Context } from "./context.ts";
import { inspectLoans, type LoanReport } from "./inspect.ts";
import { openProject } from "./project.ts";
import { syncProject } from "./status.ts";

/**
 * Run by the session-start hook. Syncs the project (overdue skills are returned,
 * missing copies restored) and returns one line for the agent's context, or null
 * when nothing needs attention — so a healthy project costs no tokens.
 */
export async function sessionNotice(ctx: Context): Promise<string | null> {
  const opened = await openProject(ctx);
  if (!opened) return null;
  const { expired } = await syncProject(ctx, opened.project, []);
  const loans = (await inspectLoans(ctx, opened.project)).map((inspection) => inspection.report);
  return formatNotice(expired, loans);
}

export function formatNotice(
  expired: readonly string[],
  loans: readonly LoanReport[],
): string | null {
  const edited = (loan: LoanReport) => loan.content === "modified" || loan.content === "diverged";
  const overdueKept = loans.filter((loan) => loan.due === "overdue");
  const dueSoon = loans.filter((loan) => loan.due === "due-soon");
  const modified = loans.filter((loan) => loan.due !== "overdue" && loan.content === "modified");
  const diverged = loans.filter((loan) => loan.due !== "overdue" && loan.content === "diverged");
  const behind = loans.filter((loan) => loan.content === "behind" && !edited(loan));

  const parts = [
    expired.length > 0 &&
      `returned after going unused: ${names(expired)} (\`shelf borrow <name>\` to get one back)`,
    dueSoon.length > 0 &&
      `due soon unless used: ${names(dueSoon.map((loan) => `${loan.skill} (${loan.daysLeft}d)`))} — \`shelf renew <name>\` to keep, \`shelf return <name>\` if unneeded`,
    overdueKept.length > 0 &&
      `overdue, not returned because of local edits: ${names(overdueKept.map((loan) => loan.skill))} — \`shelf promote\` or \`shelf detach\` them`,
    modified.length > 0 &&
      `edited here: ${names(modified.map((loan) => loan.skill))} — \`shelf promote <name>\` publishes to the library`,
    diverged.length > 0 &&
      `edited here and in the library: ${names(diverged.map((loan) => loan.skill))} — review with \`shelf diff <name>\``,
    behind.length > 0 &&
      `library has updates: ${names(behind.map((loan) => loan.skill))} — \`shelf update <name>\``,
  ].filter(Boolean);
  return parts.length > 0 ? `shelf: ${parts.join("; ")}. Details: \`shelf status\`.` : null;
}

/** At most four names, so the notice stays one short line. */
function names(items: readonly string[]): string {
  const shown = items.slice(0, 4).join(", ");
  return items.length > 4 ? `${shown} +${items.length - 4} more` : shown;
}
