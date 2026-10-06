import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, unwrap } from "../../api/client.ts";
import type { SkillSet } from "../../api/types.ts";

export const setsQuery = () =>
  queryOptions({
    queryKey: ["sets"],
    queryFn: () => unwrap(api.sets.$get()),
  });

const save = ({ name, description, skills }: SkillSet) =>
  unwrap(api.sets[":name"].$put({ param: { name }, json: { description, skills: [...skills] } }));

/** Creates a set or replaces its description and skills. */
export function useSaveSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: save,
    onSuccess: (set) => {
      void queryClient.invalidateQueries();
      toast.success(`Saved the set ${set.name}`);
    },
  });
}

/** Deletes a set, with an undo in the toast: loans are untouched, so nothing else is lost. */
export function useDeleteSet() {
  const queryClient = useQueryClient();
  const restore = useSaveSet();
  return useMutation({
    mutationFn: (name: string) => unwrap(api.sets[":name"].$delete({ param: { name } })),
    onSuccess: (set) => {
      void queryClient.invalidateQueries();
      toast.success(`Deleted the set ${set.name}`, {
        action: { label: "Undo", onClick: () => restore.mutate(set) },
      });
    },
  });
}
