import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client.ts";
import { skillQuery } from "./queries.ts";

/** A recorded revision of a skill. `revision` is a hash, a unique prefix, or `latest`. */
export const revisionQuery = (name: string, revision: string) =>
  queryOptions({
    queryKey: ["skills", name, "revisions", revision],
    queryFn: () =>
      unwrap(api.skills[":name"].revisions[":revision"].$get({ param: { name, revision } })),
  });

/** One file of a recorded revision. */
export const revisionFileQuery = (name: string, revision: string, path: string) =>
  queryOptions({
    queryKey: ["skills", name, "revisions", revision, "file", path],
    queryFn: () =>
      unwrap(
        api.skills[":name"].revisions[":revision"].file.$get({
          param: { name, revision },
          query: { path },
        }),
      ),
  });

/** What changed between two versions of a skill (revisions, `latest`, …). */
export const skillDiffQuery = (name: string, from: string, to: string) =>
  queryOptions({
    queryKey: ["skills", name, "diff", from, to],
    queryFn: () => unwrap(api.skills[":name"].diff.$get({ param: { name }, query: { from, to } })),
  });

/** Makes a revision the library's latest; borrowers keep theirs until they update. */
export function useRestoreRevision(name: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (revision: string) =>
      unwrap(
        api.skills[":name"].revisions[":revision"].restore.$post({ param: { name, revision } }),
      ),
    onSuccess: (page) => {
      queryClient.setQueryData(skillQuery(name).queryKey, page);
      void queryClient.invalidateQueries();
    },
  });
}
