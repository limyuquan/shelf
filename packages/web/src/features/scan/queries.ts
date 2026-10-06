import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, unwrap } from "../../api/client.ts";
import { summarizeAdopt } from "./select.ts";

export interface ScanParams {
  /** Absolute directory; the server picks the projects' folder when omitted. */
  readonly root?: string | undefined;
  readonly depth?: number | undefined;
}

/**
 * Walking the disk takes seconds, so a scan runs only when asked: no refetch
 * on focus and no retry. Mutations still invalidate it, which rescans.
 */
export const scanQuery = ({ root, depth }: ScanParams) =>
  queryOptions({
    queryKey: ["scan", { root: root ?? null, depth: depth ?? null }],
    queryFn: () =>
      unwrap(
        api.scan.$get({
          query: { ...(root ? { root } : {}), ...(depth ? { depth: String(depth) } : {}) },
        }),
      ),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    retry: false,
  });

/** Adopts copies in the given order; the first copy of a new skill becomes the library's. */
export function useAdopt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { paths: string[]; unedited: boolean }) =>
      unwrap(api.adopt.$post({ json: input })),
    onSuccess: (results) => {
      const { title, detail } = summarizeAdopt(results);
      toast.success(title, { description: detail });
    },
    // A failure part-way still adopted the copies before it.
    onSettled: () => void queryClient.invalidateQueries(),
  });
}
