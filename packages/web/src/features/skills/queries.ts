import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, unwrap } from "../../api/client.ts";

export const skillsQuery = (q = "") =>
  queryOptions({
    queryKey: ["skills", { q }],
    queryFn: () => unwrap(api.skills.$get({ query: q ? { q } : {} })),
  });

export const skillQuery = (name: string) =>
  queryOptions({
    queryKey: ["skills", name],
    queryFn: () => unwrap(api.skills[":name"].$get({ param: { name } })),
  });

/** Saves SKILL.md; the library records it as a new revision. */
export function useSaveSkill(name: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      unwrap(api.skills[":name"].$put({ param: { name }, json: { content } })),
    onSuccess: (page) => {
      queryClient.setQueryData(skillQuery(name).queryKey, page);
      void queryClient.invalidateQueries();
      toast.success(`Saved ${name}`, { description: "Recorded as a new revision." });
    },
  });
}

/** Updates the chosen borrowers to the library's latest revision. */
export function usePropagate(name: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projects: string[]) =>
      unwrap(api.skills[":name"].propagate.$post({ param: { name }, json: { projects } })),
    onSuccess: (result) => {
      void queryClient.invalidateQueries();
      const updated = result.projects.filter((p) => p.status === "updated").length;
      toast.success(`Updated ${updated} project${updated === 1 ? "" : "s"}`);
    },
  });
}
