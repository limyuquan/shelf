import type { ContentState } from "../../api/types.ts";

/**
 * Pure helpers for acting on several loans at once: which of the selected loans
 * each action applies to, running the requests a few at a time, and one toast
 * summarising the outcome. Unit-tested.
 */

export type BulkKind = "renew" | "update" | "keep" | "unkeep" | "return";

/** What the bulk actions need to know about a selected loan (a project row or an Attention row). */
export interface BulkLoan {
  readonly skill: string;
  readonly content: ContentState;
  readonly kept: boolean;
}

export const isEdited = (loan: BulkLoan) =>
  loan.content === "modified" || loan.content === "diverged";

/** Kept loans never come due, so renewing them would do nothing. */
export const renewable = <T extends BulkLoan>(loans: readonly T[]) =>
  loans.filter((loan) => !loan.kept);

/** Only loans behind the library have an update to take. */
export const updatable = <T extends BulkLoan>(loans: readonly T[]) =>
  loans.filter((loan) => loan.content === "behind");

/** Keep the selection, unless every selected loan already is kept. */
export function keepKind(loans: readonly BulkLoan[]): "keep" | "unkeep" {
  return loans.length > 0 && loans.every((loan) => loan.kept) ? "unkeep" : "keep";
}

export const keepable = <T extends BulkLoan>(loans: readonly T[], kind: "keep" | "unkeep") =>
  loans.filter((loan) => loan.kept !== (kind === "keep"));

/** Loans with local edits are only returned when the user also agrees to delete the edits. */
export function returnable<T extends BulkLoan>(loans: readonly T[], deleteEdits: boolean): T[] {
  return deleteEdits ? [...loans] : loans.filter((loan) => !isEdited(loan));
}

/**
 * Runs `task` over `items` with at most `limit` running at once, settling every
 * one. Results keep the items' order.
 */
export async function runPool<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { status: "fulfilled", value: await task(items[index] as T) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** One loan's result: `error` is null when the action succeeded. */
export interface BulkOutcome {
  /** The selection key, so failed rows can stay selected. */
  readonly key: string;
  /** How the loan is named in the toast: the skill, plus its project on Attention. */
  readonly label: string;
  readonly error: { readonly message: string; readonly hint: string | null } | null;
}

const DONE: Record<BulkKind, string> = {
  renew: "Renewed",
  update: "Updated",
  keep: "Keeping",
  unkeep: "Stopped keeping",
  return: "Returned",
};

const VERB: Record<BulkKind, string> = {
  renew: "renew",
  update: "update",
  keep: "keep",
  unkeep: "stop keeping",
  return: "return",
};

const skills = (count: number) => `${count} skill${count === 1 ? "" : "s"}`;

/** Failures listed in the toast before "and N more". */
const LISTED = 3;

/**
 * "Renewed 3 skills · 1 failed" plus, as the description, what failed and the
 * server's hint, e.g. "review: The project copy has local edits. Keep them with …".
 */
export function summarizeBulk(
  kind: BulkKind,
  outcomes: readonly BulkOutcome[],
): { tone: "success" | "warning" | "error"; title: string; description: string | null } {
  const failed = outcomes.filter((outcome) => outcome.error !== null);
  const succeeded = outcomes.length - failed.length;
  const done =
    succeeded === 1 && outcomes.length === 1
      ? `${DONE[kind]} ${outcomes[0]?.label}`
      : `${DONE[kind]} ${skills(succeeded)}`;
  if (failed.length === 0) return { tone: "success", title: done, description: null };

  // A lone failure is named in the title already.
  const only = succeeded === 0 && failed.length === 1;
  const lines = failed
    .slice(0, LISTED)
    .map((outcome) => (only ? "" : `${outcome.label}: `) + (outcome.error?.message ?? ""));
  if (failed.length > LISTED) lines.push(`and ${failed.length - LISTED} more`);
  // Every failure of one kind tends to share a hint; showing it once is enough.
  const hint = failed.find((outcome) => outcome.error?.hint)?.error?.hint;
  const description = [...lines, ...(hint ? [hint] : [])].join("\n");

  if (succeeded === 0) {
    const title = only
      ? `Couldn't ${VERB[kind]} ${failed[0]?.label}`
      : `Couldn't ${VERB[kind]} ${skills(failed.length)}`;
    return { tone: "error", title, description };
  }
  return { tone: "warning", title: `${done} · ${failed.length} failed`, description };
}
