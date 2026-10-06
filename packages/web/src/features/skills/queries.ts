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

/** One file of a skill, e.g. `references/patterns.md`. */
export const skillFileQuery = (name: string, path: string) =>
  queryOptions({
    queryKey: ["skills", name, "file", path],
    queryFn: () => unwrap(api.skills[":name"].file.$get({ param: { name }, query: { path } })),
  });

/** Saves a reference file; the library records it as a new revision. */
export function useSaveFile(name: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      unwrap(api.skills[":name"].file.$put({ param: { name }, json: { path, content } })),
    onSuccess: (file) => {
      queryClient.setQueryData(skillFileQuery(name, file.path).queryKey, file);
      void queryClient.invalidateQueries();
      toast.success(`Saved ${file.path}`, { description: "Recorded as a new revision." });
    },
  });
}

/** Fetches the linked source and audits it; with `yes`, applies it to the library. */
export function usePull(name: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options: { yes?: boolean; force?: boolean }) =>
      unwrap(api.skills[":name"].pull.$post({ param: { name }, json: options })),
    onSuccess: (result) => {
      if (result.status !== "imported") return;
      void queryClient.invalidateQueries();
      toast.success(`Updated ${name} from its source`, {
        description: "Projects borrowing it can now update.",
      });
    },
  });
}
