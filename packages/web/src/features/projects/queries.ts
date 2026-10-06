import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client.ts";

export const projectsQuery = () =>
  queryOptions({
    queryKey: ["projects"],
    queryFn: () => unwrap(api.projects.$get()),
  });

export const projectQuery = (id: string) =>
  queryOptions({
    queryKey: ["projects", id],
    queryFn: () => unwrap(api.projects[":id"].$get({ param: { id } })),
  });

/** Library skills matching what the project uses, best first. */
export const projectSuggestionsQuery = (id: string) =>
  queryOptions({
    queryKey: ["projects", id, "suggestions"],
    queryFn: () => unwrap(api.projects[":id"].suggestions.$get({ param: { id } })),
  });
