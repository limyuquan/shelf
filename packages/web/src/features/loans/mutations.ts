import { useMutation, useQueryClient } from "@tanstack/react-query";
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
