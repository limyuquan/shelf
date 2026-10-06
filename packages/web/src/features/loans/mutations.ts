import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, api, unwrap } from "../../api/client.ts";
import { type BulkKind, type BulkOutcome, runPool, summarizeBulk } from "./bulk.ts";

export type LoanAction =
  | { kind: "renew"; reason?: string }
  | { kind: "due"; when: string }
  | { kind: "update"; force?: boolean }
  | { kind: "return"; force?: boolean }
  | { kind: "keep"; keep: boolean };

interface Target {
  readonly projectId: string;
  readonly skill: string;
}

function run({ projectId, skill }: Target, action: LoanAction) {
  const param = { id: projectId, skill };
  const loan = api.projects[":id"].loans[":skill"];
  switch (action.kind) {
    case "renew":
      return unwrap(
        loan.renew.$post({ param, json: action.reason ? { reason: action.reason } : {} }),
      );
    case "due":
      return unwrap(loan.due.$post({ param, json: { when: action.when } }));
    case "update":
      return unwrap(loan.update.$post({ param, json: { force: action.force ?? false } }));
    case "return":
      return unwrap(loan.return.$post({ param, json: { force: action.force ?? false } }));
    case "keep":
      return unwrap(loan.keep.$post({ param, json: { keep: action.keep } }));
  }
}

function done(skill: string, action: LoanAction): string {
  switch (action.kind) {
    case "renew":
      return `Renewed ${skill}`;
    case "due":
      return `Moved the due date of ${skill}`;
    case "update":
      return `Updated ${skill} to the latest revision`;
    case "return":
      return `Returned ${skill}`;
    case "keep":
      return action.keep ? `Keeping ${skill}: it never expires` : `Stopped keeping ${skill}`;
  }
}

/**
 * Renew, move, update, keep or return a loan. Every view reads from the same few
 * queries, so a mutation simply refreshes them all.
 */
export function useLoanAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ target, action }: { target: Target; action: LoanAction }) => run(target, action),
    onSuccess: (_result, { target, action }) => {
      void queryClient.invalidateQueries();
      toast.success(done(target.skill, action));
    },
  });
}

/** One loan in a bulk action. */
export interface BulkTarget extends Target {
  /** The selection key, so rows whose action failed can stay selected. */
  readonly key: string;
  /** How the loan is named in the summary toast. */
  readonly label: string;
  /** Return: also delete local edits. */
  readonly force?: boolean;
}

/** Enough at once to be quick, few enough not to pile writes onto one project. */
const BULK_CONCURRENCY = 4;

function bulkAction(kind: BulkKind, target: BulkTarget): LoanAction {
  switch (kind) {
    case "renew":
      return { kind: "renew" };
    case "update":
      return { kind: "update" };
    case "keep":
      return { kind: "keep", keep: true };
    case "unkeep":
      return { kind: "keep", keep: false };
    case "return":
      return { kind: "return", force: target.force ?? false };
  }
}

/**
 * Renews, updates, keeps or returns several loans: a few requests at a time,
 * one refresh and one toast summarising what worked and what didn't. Resolves
 * with each loan's outcome; never rejects for a failed loan.
 */
export function useBulkLoanAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, targets }: { kind: BulkKind; targets: readonly BulkTarget[] }) => {
      const settled = await runPool(targets, BULK_CONCURRENCY, (target) =>
        run(target, bulkAction(kind, target)),
      );
      return settled.map((result, index): BulkOutcome => {
        const target = targets[index] as BulkTarget;
        if (result.status === "fulfilled")
          return { key: target.key, label: target.label, error: null };
        const error = result.reason;
        return {
          key: target.key,
          label: target.label,
          error: {
            message: error instanceof Error ? error.message : String(error),
            hint: error instanceof ApiError ? error.hint : null,
          },
        };
      });
    },
    onSuccess: (outcomes, { kind }) => {
      void queryClient.invalidateQueries();
      const summary = summarizeBulk(kind, outcomes);
      toast[summary.tone](summary.title, {
        ...(summary.description ? { description: summary.description } : {}),
        // One failure per line, shown long enough to read them.
        ...(summary.tone === "success"
          ? {}
          : { duration: 10_000, classNames: { description: "whitespace-pre-line" } }),
      });
    },
  });
}

/** What changed in a borrowed copy: its edits, or pending library changes. */
export const loanDiffQuery = (projectId: string, skill: string) =>
  queryOptions({
    queryKey: ["projects", projectId, "diff", skill],
    queryFn: () =>
      unwrap(
        api.projects[":id"].loans[":skill"].diff.$get({
          param: { id: projectId, skill },
          query: {},
        }),
      ),
  });

/** Publishes a project's edits to the library, optionally updating every other borrower. */
export function usePromote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ target, ...json }: { target: Target; force?: boolean; propagate?: boolean }) =>
      unwrap(
        api.projects[":id"].loans[":skill"].promote.$post({
          param: { id: target.projectId, skill: target.skill },
          json,
        }),
      ),
    onSuccess: (result, { target }) => {
      void queryClient.invalidateQueries();
      const updated = result.propagation?.projects.filter((p) => p.status === "updated").length;
      toast.success(`Promoted ${target.skill} to the library`, {
        ...(updated
          ? { description: `Updated ${updated} other project${updated === 1 ? "" : "s"}.` }
          : {}),
      });
    },
  });
}

/** Borrows library skills into a project. */
export function useBorrow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      skills,
      keep,
    }: {
      projectId: string;
      skills: string[];
      /** Never expires. */
      keep?: boolean;
    }) =>
      unwrap(
        api.projects[":id"].loans.$post({
          param: { id: projectId },
          json: keep ? { skills, keep } : { skills },
        }),
      ),
    onSuccess: (results) => {
      void queryClient.invalidateQueries();
      const names = results.filter((r) => r.status === "borrowed").map((r) => r.skill);
      toast.success(
        names.length === 1 ? `Borrowed ${names[0]}` : `Borrowed ${names.length} skills`,
      );
    },
  });
}

/** Restores missing copies (and returns overdue loans) in one project. */
export function useSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      unwrap(api.projects[":id"].sync.$post({ param: { id: projectId } })),
    onSuccess: (report) => {
      void queryClient.invalidateQueries();
      const restored = report.restored.length;
      toast.success(restored > 0 ? `Restored ${report.restored.join(", ")}` : "Project is in sync");
    },
  });
}
