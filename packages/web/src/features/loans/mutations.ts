import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, unwrap } from "../../api/client.ts";

export type LoanAction =
  | { kind: "renew"; reason?: string }
  | { kind: "due"; when: string }
  | { kind: "update"; force?: boolean }
  | { kind: "return"; force?: boolean };

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
  }
}

const DONE: Record<LoanAction["kind"], (skill: string) => string> = {
  renew: (skill) => `Renewed ${skill}`,
  due: (skill) => `Moved the due date of ${skill}`,
  update: (skill) => `Updated ${skill} to the latest revision`,
  return: (skill) => `Returned ${skill}`,
};

/**
 * Renew, move, update or return a loan. Every view reads from the same few
 * queries, so a mutation simply refreshes them all.
 */
export function useLoanAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ target, action }: { target: Target; action: LoanAction }) => run(target, action),
    onSuccess: (_result, { target, action }) => {
      void queryClient.invalidateQueries();
      toast.success(DONE[action.kind](target.skill));
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
    mutationFn: ({ projectId, skills }: { projectId: string; skills: string[] }) =>
      unwrap(api.projects[":id"].loans.$post({ param: { id: projectId }, json: { skills } })),
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
