import { isClean } from "../domain/loan-state.ts";
import type { LoanReport } from "./inspect.ts";

/** A suggested next step. `command` is runnable as-is, except for `<why>` placeholders. */
export interface Action {
  readonly command: string;
  readonly reason: string;
}

/** Derives next steps from loan reports, most urgent first, without duplicates. */
export function suggestActions(loans: readonly LoanReport[]): Action[] {
  const actions: Action[] = [];
  const add = (action: Action) => {
    if (!actions.some((existing) => existing.command === action.command)) actions.push(action);
  };

  for (const loan of loans) {
    const { skill, content } = loan;
    if (content === "missing") {
      add({ command: "shelf sync", reason: `Copies of ${skill} are missing; sync restores them` });
    } else if (content === "diverged") {
      add({
        command: `shelf show ${skill}`,
        reason: `${skill} was edited both here and in the library. Review, then keep this project's edits with \`shelf promote ${skill} --force\` or take the library's with \`shelf update ${skill} --force\``,
      });
    } else if (content === "modified") {
      add({
        command: `shelf promote ${skill}`,
        reason: `${skill} has local edits. Promote them to the library, keep them unmanaged with \`shelf detach ${skill}\`, or discard them with \`shelf update ${skill} --force\``,
      });
    } else if (content === "behind") {
      add(
        loan.policy === "follow"
          ? { command: "shelf sync", reason: `The library has a newer revision of ${skill}` }
          : {
              command: `shelf update ${skill}`,
              reason: `The library has a newer revision of ${skill}`,
            },
      );
    }

    if (loan.due === "overdue" && !isClean(content)) {
      add({
        command: `shelf detach ${skill}`,
        reason: `${skill} is overdue but kept because it has local edits. Promote or detach it`,
      });
    } else if (loan.due === "due-soon") {
      add({
        command: `shelf renew ${skill} --reason "<why>"`,
        reason: `${skill} is due in ${loan.daysLeft} day(s). Renew it if it is still useful, otherwise \`shelf return ${skill}\``,
      });
    }
  }
  return actions;
}
