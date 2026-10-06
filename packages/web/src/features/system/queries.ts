import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, unwrap } from "../../api/client.ts";

export const systemQuery = () =>
  queryOptions({
    queryKey: ["system"],
    queryFn: () => unwrap(api.system.$get()),
    // Health checks hash the object store; there is no need to repeat them often.
    staleTime: 60_000,
  });

/** `shelf doctor --fix`: reinstalls hooks, forgets missing projects, cleans leftovers. */
export function useRepair() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.system.repair.$post()),
    onSuccess: (report) => {
      queryClient.setQueryData(systemQuery().queryKey, report);
      void queryClient.invalidateQueries();
      toast.success("Repaired what could be repaired");
    },
  });
}
