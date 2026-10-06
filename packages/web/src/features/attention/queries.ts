import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client.ts";

export const attentionQuery = () =>
  queryOptions({
    queryKey: ["attention"],
    queryFn: () => unwrap(api.attention.$get()),
  });
