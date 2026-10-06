import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { FileText, RotateCcw } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import type { Revision, SkillPage } from "../api/types.ts";
import { rootRoute } from "../app/root-route.tsx";
import { DiffView } from "../components/diff-view.tsx";
import { PageHeader, SplitView } from "../components/layout/page.tsx";
import { PropertiesPanel, Property, PropertyGroup } from "../components/layout/properties.tsx";
import { Button } from "../components/ui/button.tsx";
import { Dialog, DialogLayout } from "../components/ui/dialog.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { Tooltip } from "../components/ui/tooltip.tsx";
import { skillQuery } from "../features/skills/queries.ts";
import { RevisionHistory, revisionParam } from "../features/skills/revision-history.tsx";
import {
  revisionFileQuery,
  revisionQuery,
  skillDiffQuery,
  useRestoreRevision,
} from "../features/skills/revisions.ts";
import { languageFor, SkillEditor } from "../features/skills/skill-editor.tsx";
import { cn } from "../lib/cn.ts";
import { shortDate, shortHash } from "../lib/format.ts";

const SKILL_FILE = "SKILL.md";
const LATEST = "latest";

/** `?compare=<hash>|latest` picks the other side of Changes; `?tab=files&file=…` opens a file. */
const revisionSearch = z.object({
  tab: z.enum(["changes", "files"]).optional(),
  file: z.string().optional(),
  compare: z.string().optional(),
});
type RevisionSearch = z.infer<typeof revisionSearch>;

export const revisionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/library/$skillName/revisions/$revision",
  validateSearch: revisionSearch,
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(revisionQuery(params.skillName, params.revision)),
      context.queryClient.ensureQueryData(skillQuery(params.skillName)),
    ]),
  component: RevisionPage,
});

interface CompareOption {
  readonly value: string;
  readonly label: string;
}

/** Every other revision, plus `latest` unless this is it. */
function compareOptions(revision: Revision, page: SkillPage): CompareOption[] {
  const head = page.history.revisions.find((r) => r.latest);
  const options: CompareOption[] = [];
  if (!revision.latest && head) {
    options.push({ value: LATEST, label: `Latest (${shortHash(head.hash)})` });
  }
  for (const other of page.history.revisions) {
    if (other.hash === revision.revision) continue;
    const notes = [other.hash === revision.parent && "parent", other.latest && "latest"].filter(
      Boolean,
    );
    options.push({
      value: revisionParam(other.hash),
      label: [shortHash(other.hash), other.source, shortDate(other.createdAt), ...notes].join(
        " · ",
      ),
    });
  }
  return options;
}

function RevisionPage() {
  const { skillName, revision: ref } = revisionRoute.useParams();
  const search = revisionRoute.useSearch();
  const { data: revision } = useSuspenseQuery(revisionQuery(skillName, ref));
  const { data: page } = useSuspenseQuery(skillQuery(skillName));
  const [restoring, setRestoring] = useState(false);

  const options = compareOptions(revision, page);
  const parent = revision.parent ? revisionParam(revision.parent) : null;
  const fallback = options.some((option) => option.value === parent) ? parent : options[0]?.value;
  const compare = search.compare ?? fallback ?? null;
  const tab = search.tab ?? (compare ? "changes" : "files");
  const short = shortHash(revision.revision);

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Library", to: "/library" },
          { label: skillName, to: `/library/${skillName}` },
          { label: `rev ${short}` },
        ]}
      />
      <SplitView
        main={
          <div className="mx-auto max-w-[820px] px-4 pt-6 pb-24 md:px-10 md:pt-9">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 font-semibold text-[20px] text-fg tracking-tight md:text-[22px]">
                  <span className="break-words">{skillName}</span>
                  <code className="font-mono font-normal text-[15px] text-fg-muted md:text-[16px]">
                    rev {short}
                  </code>
                  {revision.latest && (
                    <span className="self-center rounded-full bg-accent-soft px-2 py-px font-normal text-[12px] text-accent tracking-normal">
                      latest
                    </span>
                  )}
                </h1>
                <p className="mt-2 text-[13px] text-fg-muted">
                  Recorded {shortDate(revision.createdAt)} from {revision.source}
                  {parent && revision.parent && (
                    <>
                      {" · after "}
                      <RevisionLink skill={skillName} hash={revision.parent} />
                    </>
                  )}
                </p>
              </div>
              {!revision.latest && (
                <Button
                  size="md"
                  onClick={() => setRestoring(true)}
                  className="max-sm:w-full max-sm:pointer-coarse:h-11"
                >
                  <RotateCcw />
                  Restore this revision
                </Button>
              )}
            </div>

            <div className="mt-7 flex items-center gap-1 border-border-subtle border-b">
              <TabLink active={tab === "changes"} search={{ ...search, tab: "changes" }}>
                Changes
              </TabLink>
              <TabLink active={tab === "files"} search={{ ...search, tab: "files" }}>
                Files <span className="text-fg-subtle">{revision.files.length}</span>
              </TabLink>
            </div>

            {tab === "changes" ? (
              <Changes revision={revision} options={options} compare={compare} />
            ) : (
              <Files revision={revision} file={search.file ?? SKILL_FILE} />
            )}
          </div>
        }
        aside={<RevisionProperties revision={revision} page={page} />}
      />
      <RestoreDialog
        open={restoring}
        onOpenChange={setRestoring}
        revision={revision}
        borrowers={page.propagation.projects.length}
      />
    </>
  );
}

function RevisionLink({ skill, hash }: { skill: string; hash: string }) {
  return (
    <Link
      to="/library/$skillName/revisions/$revision"
      params={{ skillName: skill, revision: revisionParam(hash) }}
      search={{}}
      className="font-mono text-[12px] text-fg hover:underline"
    >
      {shortHash(hash)}
    </Link>
  );
}

function TabLink({
  active,
  search,
  children,
}: {
  active: boolean;
  search: RevisionSearch;
  children: ReactNode;
}) {
  return (
    <Link
      from={revisionRoute.fullPath}
      search={search}
      replace
      className={cn(
        "-mb-px flex h-9 items-center gap-1.5 border-b-2 px-2.5 text-[13px] transition-colors pointer-coarse:h-11 pointer-coarse:px-3.5",
        active
          ? "border-accent font-medium text-fg"
          : "border-transparent text-fg-muted hover:text-fg",
      )}
    >
      {children}
    </Link>
  );
}

/** The diff from the chosen revision to this one. */
function Changes({
  revision,
  options,
  compare,
}: {
  revision: Revision;
  options: CompareOption[];
  compare: string | null;
}) {
  const navigate = useNavigate({ from: revisionRoute.fullPath });
  const diff = useQuery({
    ...skillDiffQuery(revision.skill, compare ?? LATEST, revisionParam(revision.revision)),
    enabled: compare !== null,
  });

  if (compare === null) {
    return (
      <p className="py-10 text-center text-[13px] text-fg-muted">
        This is the only revision of {revision.skill}, so there is nothing to compare it with.
      </p>
    );
  }
  const parent = revision.parent ? revisionParam(revision.parent) : null;
  const caption =
    compare === parent
      ? "What this revision changed."
      : compare === LATEST
        ? "What restoring this revision would change."
        : "Changes from the selected revision to this one.";

  return (
    <>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <label htmlFor="compare-with" className="shrink-0 text-[13px] text-fg-muted">
          Compare with
        </label>
        <select
          id="compare-with"
          value={compare}
          onChange={(event) =>
            void navigate({
              search: (prev) => ({ ...prev, compare: event.target.value }),
              replace: true,
            })
          }
          className="h-8 min-w-0 rounded-md border border-border bg-surface-raised px-2 font-mono text-[12.5px] text-fg outline-none transition-colors hover:border-border-strong focus-visible:border-accent max-sm:w-full pointer-coarse:h-11 pointer-coarse:font-sans pointer-coarse:text-[16px] sm:max-w-[360px]"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="text-[12.5px] text-fg-subtle">{caption}</span>
      </div>
      <div className="mt-4">
        {diff.isError ? (
          <p className="py-8 text-center text-red">{diff.error.message}</p>
        ) : diff.data ? (
          <DiffView files={diff.data.files} />
        ) : (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9" />
            <Skeleton className="h-40" />
          </div>
        )}
      </div>
    </>
  );
}

/** The revision's files, read-only. */
function Files({ revision, file }: { revision: Revision; file: string }) {
  const others = revision.files.filter((path) => path !== SKILL_FILE);
  return (
    <>
      <div className="mt-3 flex items-center gap-1 overflow-x-auto">
        {[SKILL_FILE, ...others].map((path) => (
          <Tooltip key={path} label={path}>
            <Link
              from={revisionRoute.fullPath}
              search={(prev) => ({ ...prev, tab: "files" as const, file: path })}
              replace
              className={cn(
                "flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] transition-colors pointer-coarse:h-10",
                path === file
                  ? "bg-surface-hover font-medium text-fg"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              <FileText className="size-3.5 text-fg-subtle" />
              {path.split("/").at(-1)}
            </Link>
          </Tooltip>
        ))}
      </div>
      {file === SKILL_FILE ? (
        <ReadOnlyFile key={SKILL_FILE} path={SKILL_FILE} content={revision.content} />
      ) : (
        <RevisionFile key={file} revision={revision} path={file} />
      )}
    </>
  );
}

function RevisionFile({ revision, path }: { revision: Revision; path: string }) {
  const file = useQuery(revisionFileQuery(revision.skill, revisionParam(revision.revision), path));
  if (file.isError) return <p className="mt-6 text-red">{file.error.message}</p>;
  if (!file.data) return <Skeleton className="mt-4 h-80" />;
  if (file.data.content === null) {
    return (
      <p className="mt-8 text-center text-fg-muted">
        {path} is a binary file ({Math.ceil(file.data.size / 1024)} KB) and can't be shown.
      </p>
    );
  }
  return <ReadOnlyFile path={path} content={file.data.content} />;
}

function ReadOnlyFile({ path, content }: { path: string; content: string }) {
  return (
    <div className="-mx-2 mt-1">
      <SkillEditor value={content} language={languageFor(path)} readOnly />
    </div>
  );
}

function RevisionProperties({ revision, page }: { revision: Revision; page: SkillPage }) {
  return (
    <PropertiesPanel>
      <PropertyGroup title="Revision">
        <Property label="Hash">
          <code className="font-mono text-[12px]" title={revision.revision}>
            {shortHash(revision.revision, 12)}
          </code>
        </Property>
        <Property label="Source">{revision.source}</Property>
        <Property label="Recorded">{shortDate(revision.createdAt)}</Property>
        <Property label="Parent">
          {revision.parent ? (
            <RevisionLink skill={revision.skill} hash={revision.parent} />
          ) : (
            <span className="text-fg-muted">None (first revision)</span>
          )}
        </Property>
        <Property label="Files">{revision.files.length}</Property>
        <Property label="Tokens">~{revision.tokens.toLocaleString()}</Property>
      </PropertyGroup>

      <RevisionHistory
        skill={revision.skill}
        revisions={page.history.revisions}
        current={revision.revision}
      />
    </PropertiesPanel>
  );
}

function RestoreDialog({
  open,
  onOpenChange,
  revision,
  borrowers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  revision: Revision;
  borrowers: number;
}) {
  const navigate = useNavigate();
  const restore = useRestoreRevision(revision.skill);
  const short = shortHash(revision.revision);
  const onRestore = () =>
    restore.mutate(revisionParam(revision.revision), {
      onSuccess: () => {
        onOpenChange(false);
        toast.success(`Restored ${revision.skill} to rev ${short}`, {
          description: "Projects that borrow it keep their revision until you update them.",
        });
        void navigate({ to: "/library/$skillName", params: { skillName: revision.skill } });
      },
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="w-[min(480px,calc(100vw-32px))]">
      <DialogLayout
        title={`Restore ${revision.skill} to rev ${short}?`}
        description="The library copy is replaced with this revision, which becomes the latest. Nothing is deleted: every revision stays in the history."
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" disabled={restore.isPending} onClick={onRestore}>
              <RotateCcw />
              Restore
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-fg-muted leading-relaxed">
          {borrowers === 0
            ? "No project borrows this skill."
            : `${borrowers} project${borrowers === 1 ? " borrows" : "s borrow"} this skill. ${borrowers === 1 ? "It keeps its" : "They keep their"} current revision until you update ${borrowers === 1 ? "it" : "them"} from the skill page.`}
        </p>
      </DialogLayout>
    </Dialog>
  );
}
