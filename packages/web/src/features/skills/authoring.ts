import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, unwrap } from "../../api/client.ts";
import type { SkillPage } from "../../api/types.ts";
import { shortPath } from "../../lib/format.ts";
import { skillQuery } from "./queries.ts";

/** Errors are shown inside the dialog that made the call, not as a toast. */
const inline = { onError: () => {} };

/**
 * After a call that gives the skill a (new) name: seed its page, go there, then
 * refresh everything. Navigating first keeps the old page from refetching a name
 * that no longer exists.
 */
function useOpenSkillPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async (page: SkillPage, previous?: string) => {
    queryClient.setQueryData(skillQuery(page.detail.name).queryKey, page);
    await navigate({
      to: "/library/$skillName",
      params: { skillName: page.detail.name },
      replace: previous !== undefined,
    });
    if (previous) queryClient.removeQueries({ queryKey: skillQuery(previous).queryKey });
    void queryClient.invalidateQueries();
  };
}

/** Creates a skill from the template and opens it. */
export function useCreateSkill() {
  const open = useOpenSkillPage();
  return useMutation({
    ...inline,
    mutationFn: (input: { name: string; description: string }) =>
      unwrap(api.skills.$post({ json: input })),
    onSuccess: async (page) => {
      await open(page);
      toast.success(`Created ${page.detail.name}`, {
        description: "Write its instructions; each save records a revision.",
      });
    },
  });
}

export function useRenameSkill(name: string) {
  const open = useOpenSkillPage();
  return useMutation({
    ...inline,
    mutationFn: (to: string) =>
      unwrap(api.skills[":name"].rename.$post({ param: { name }, json: { to } })),
    onSuccess: async (page) => {
      await open(page, name);
      toast.success(`Renamed ${name} to ${page.detail.name}`, {
        description: "Its history and activity came along.",
      });
    },
  });
}

export function useDuplicateSkill(name: string) {
  const open = useOpenSkillPage();
  return useMutation({
    ...inline,
    mutationFn: (to: string) =>
      unwrap(api.skills[":name"].duplicate.$post({ param: { name }, json: { to } })),
    onSuccess: async (page) => {
      await open(page);
      toast.success(`Copied ${name} to ${page.detail.name}`);
    },
  });
}

/** Moves the skill to the archive and returns to the library. */
export function useArchiveSkill(name: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    ...inline,
    mutationFn: () => unwrap(api.skills[":name"].archive.$post({ param: { name } })),
    onSuccess: async (result) => {
      await navigate({ to: "/library" });
      queryClient.removeQueries({ queryKey: skillQuery(name).queryKey });
      void queryClient.invalidateQueries();
      toast.success(`Archived ${name}`, {
        description: `Moved to ${shortPath(result.path)}. Move it back into the library to restore it.`,
      });
    },
  });
}

/** Lint results for a SKILL.md draft; the server's linter, so both agree. */
export const lintQuery = (name: string, content: string) =>
  queryOptions({
    queryKey: ["lint", name, content],
    queryFn: () => unwrap(api.skills.lint.$post({ json: { name, content } })),
    staleTime: Number.POSITIVE_INFINITY,
  });

/** `value`, once it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}
