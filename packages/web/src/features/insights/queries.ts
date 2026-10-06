import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client.ts";

export const insightsQuery = () =>
  queryOptions({
    queryKey: ["insights"],
    queryFn: () => unwrap(api.insights.$get()),
  });
