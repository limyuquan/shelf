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
