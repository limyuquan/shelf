import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client.ts";

export interface ActivityFilter {
  readonly project?: string;
  readonly skill?: string;
  readonly limit?: number;
}

export const activityQuery = (filter: ActivityFilter = {}) =>
  queryOptions({
    queryKey: ["activity", filter],
    queryFn: () =>
      unwrap(
        api.activity.$get({
          query: {
            ...(filter.project ? { project: filter.project } : {}),
            ...(filter.skill ? { skill: filter.skill } : {}),
            ...(filter.limit ? { limit: String(filter.limit) } : {}),
          },
        }),
      ),
  });
