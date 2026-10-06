import { Link } from "@tanstack/react-router";
import { GitBranch } from "lucide-react";
import type { SkillPage } from "../../api/types.ts";
import { PropertyGroup } from "../../components/layout/properties.tsx";
import { cn } from "../../lib/cn.ts";
import { shortDate, shortHash } from "../../lib/format.ts";

type Revision = SkillPage["history"]["revisions"][number];

/** The hash as it appears in revision URLs: the full hex, which never becomes ambiguous. */
export const revisionParam = (hash: string) => hash.replace(/^sha256:/, "");

/** A skill's revisions, newest first; each opens its revision page. */
export function RevisionHistory({
  skill,
  revisions,
  current,
}: {
  skill: string;
  revisions: readonly Revision[];
  /** The revision being viewed, highlighted. */
  current?: string;
}) {
  return (
    <PropertyGroup title="History">
      {revisions.map((revision) => (
        <Link
          key={revision.hash}
          to="/library/$skillName/revisions/$revision"
          params={{ skillName: skill, revision: revisionParam(revision.hash) }}
          aria-current={revision.hash === current ? "page" : undefined}
          className={cn(
            "-mx-2 flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors hover:bg-surface-hover pointer-coarse:h-10",
            revision.hash === current && "bg-surface-hover",
          )}
        >
          <GitBranch className="size-3.5 shrink-0 text-fg-subtle" />
          <code className="font-mono text-[12px] text-fg">{shortHash(revision.hash)}</code>
          <span className="truncate text-fg-muted">{revision.source}</span>
          {revision.latest && (
            <span className="rounded-full bg-accent-soft px-1.5 text-[11px] text-accent">
              latest
            </span>
          )}
          <span className="ml-auto shrink-0 text-[12px] text-fg-subtle">
            {shortDate(revision.createdAt)}
          </span>
        </Link>
      ))}
    </PropertyGroup>
  );
}
