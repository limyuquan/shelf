import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createRoute, Link, useBlocker } from "@tanstack/react-router";
import { Copy, FileText, Link2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import type { SkillPage as SkillPageData } from "../api/types.ts";
import { rootRoute } from "../app/root-route.tsx";
import { PageHeader, SplitView } from "../components/layout/page.tsx";
import { PropertiesPanel, Property, PropertyGroup } from "../components/layout/properties.tsx";
import { Button, IconButton } from "../components/ui/button.tsx";
import { Dialog, DialogLayout } from "../components/ui/dialog.tsx";
import { Kbd } from "../components/ui/kbd.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { Tooltip } from "../components/ui/tooltip.tsx";
import { Borrowers } from "../features/skills/borrowers.tsx";
import { PullDialog } from "../features/skills/pull-dialog.tsx";
import {
  skillFileQuery,
  skillQuery,
  useSaveFile,
  useSaveSkill,
} from "../features/skills/queries.ts";
import { RevisionHistory } from "../features/skills/revision-history.tsx";
import { languageFor, SkillEditor } from "../features/skills/skill-editor.tsx";
import { cn } from "../lib/cn.ts";
import { shortHash, shortPath, sourceLabel } from "../lib/format.ts";

const SKILL_FILE = "SKILL.md";

export const skillRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/library/$skillName",
  // `?file=references/x.md` opens a reference file instead of SKILL.md.
  validateSearch: z.object({ file: z.string().optional() }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(skillQuery(params.skillName)),
  component: SkillPage,
});

function SkillPage() {
  const { skillName } = skillRoute.useParams();
  const { file = SKILL_FILE } = skillRoute.useSearch();
  const { data: page } = useSuspenseQuery(skillQuery(skillName));
  const { detail } = page;
  const [pulling, setPulling] = useState(false);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Library", to: "/library" }, { label: detail.name }]}
        actions={
          <>
            <Tooltip label="Copy library path">
              <IconButton
                label="Copy library path"
                onClick={() => {
                  void navigator.clipboard.writeText(detail.path);
                  toast.success("Copied the library path");
                }}
              >
                <Copy />
              </IconButton>
            </Tooltip>
            {detail.source && (
              <Button onClick={() => setPulling(true)} aria-label="Check for updates">
                <RefreshCw />
                <span className="max-sm:hidden">Check for updates</span>
              </Button>
            )}
          </>
        }
      />
      <SplitView
        main={
          <div className="mx-auto max-w-[820px] px-4 pt-6 pb-24 md:px-10 md:pt-9">
            <h1 className="break-words font-semibold text-[20px] text-fg tracking-tight md:text-[22px]">
              {detail.name}
            </h1>
            <p className="mt-2 max-w-[640px] text-[14px] text-fg-muted leading-relaxed">
              {detail.description}
            </p>
            <FileTabs skill={detail.name} files={detail.files} active={file} />
            {file === SKILL_FILE ? (
              <FileEditor
                key={SKILL_FILE}
                skill={detail.name}
                path={SKILL_FILE}
                content={detail.content}
              />
            ) : (
              <ReferenceFile key={file} skill={detail.name} path={file} />
            )}
          </div>
        }
        aside={<SkillProperties page={page} />}
      />
      {detail.source && (
        <PullDialog
          open={pulling}
          onOpenChange={setPulling}
          skill={detail.name}
          source={detail.source}
        />
      )}
    </>
  );
}

/** SKILL.md first, then the skill's other files. */
function FileTabs({ skill, files, active }: { skill: string; files: string[]; active: string }) {
  const others = files.filter((file) => file !== SKILL_FILE);
  return (
    <div className="mt-7 flex items-center gap-1 overflow-x-auto border-border-subtle border-b">
      {[SKILL_FILE, ...others].map((file) => (
        <Tooltip key={file} label={file}>
          <Link
            to="/library/$skillName"
            params={{ skillName: skill }}
            search={file === SKILL_FILE ? {} : { file }}
            className={cn(
              "-mb-px flex h-9 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-[12.5px] transition-colors",
              file === active
                ? "border-accent font-medium text-fg"
                : "border-transparent text-fg-muted hover:text-fg",
            )}
          >
            <FileText className="size-3.5 text-fg-subtle" />
            {file.split("/").at(-1)}
          </Link>
        </Tooltip>
      ))}
    </div>
  );
}

function ReferenceFile({ skill, path }: { skill: string; path: string }) {
  const file = useQuery(skillFileQuery(skill, path));
  if (file.isError) return <p className="mt-6 text-red">{file.error.message}</p>;
  if (!file.data) return <Skeleton className="mt-4 h-80" />;
  if (file.data.content === null) {
    return (
      <p className="mt-8 text-center text-fg-muted">
        {path} is a binary file ({Math.ceil(file.data.size / 1024)} KB) and can't be shown.
      </p>
    );
  }
  return <FileEditor skill={skill} path={path} content={file.data.content} />;
}

/** The editor for one file, with a save bar while it has unsaved changes. */
function FileEditor({ skill, path, content }: { skill: string; path: string; content: string }) {
  const [draft, setDraft] = useState(content);
  const saveSkill = useSaveSkill(skill);
  const saveFile = useSaveFile(skill);
  const saving = saveSkill.isPending || saveFile.isPending;
  const dirty = draft !== content;
  // Switching files, leaving the page or closing the tab would lose the edits.
  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: dirty,
    withResolver: true,
  });

  // A refetch after saving (or an edit elsewhere) brings new content: adopt it.
  useEffect(() => setDraft(content), [content]);

  const onSave = () => {
    if (!dirty || saving) return;
    if (path === SKILL_FILE) saveSkill.mutate(draft);
    else saveFile.mutate({ path, content: draft });
  };

  return (
    <>
      <div className="-mx-2 mt-1">
        <SkillEditor
          value={draft}
          onChange={setDraft}
          onSave={onSave}
          language={languageFor(path)}
        />
      </div>
      {dirty && (
        <div className="-translate-x-1/2 fixed bottom-[calc(env(safe-area-inset-bottom)+12px)] left-1/2 z-20 flex w-max max-w-[calc(100vw-24px)] items-center gap-2 rounded-lg bg-surface-overlay py-1.5 pr-1.5 pl-3.5 shadow-popup xl:sticky xl:bottom-5">
          <span className="truncate text-[13px] text-fg-muted">
            <span className="max-sm:hidden">Unsaved changes to </span>
            {path}
          </span>
          <Button variant="ghost" onClick={() => setDraft(content)}>
            Discard
          </Button>
          <Button variant="primary" onClick={onSave} disabled={saving}>
            Save <Kbd className="border-white/25 bg-white/10 text-white/80">⌘S</Kbd>
          </Button>
        </div>
      )}
      <Dialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => !open && blocker.reset?.()}
        className="w-[min(440px,calc(100vw-32px))]"
      >
        <DialogLayout
          title="Discard unsaved changes?"
          description={`Your edits to ${path} haven't been saved.`}
          footer={
            <>
              <Button variant="ghost" onClick={() => blocker.reset?.()}>
                Keep editing
              </Button>
              <Button variant="primary" onClick={() => blocker.proceed?.()}>
                Discard changes
              </Button>
            </>
          }
        >
          <p className="text-[13px] text-fg-muted">Save first with ⌘S to keep them.</p>
        </DialogLayout>
      </Dialog>
    </>
  );
}

function SkillProperties({ page }: { page: SkillPageData }) {
  const { detail, history } = page;
  return (
    <PropertiesPanel>
      <PropertyGroup title="Details">
        <Property label="Revision">
          <code className="font-mono text-[12px]">{shortHash(detail.revision)}</code>
        </Property>
        <Property label="Revisions">{detail.revisions}</Property>
        <Property label="Tokens">~{detail.tokens.toLocaleString()}</Property>
        <Property label="Source">
          {detail.source ? (
            <span className="flex items-center gap-1.5" title={detail.source}>
              <Link2 className="size-3.5 shrink-0 text-fg-muted" />
              <span className="truncate">{sourceLabel(detail.source)}</span>
            </span>
          ) : (
            <span className="text-fg-muted">Your library</span>
          )}
        </Property>
        <Property label="Location">
          <span className="font-mono text-[12px] text-fg-muted" title={detail.path}>
            {shortPath(detail.path)}
          </span>
        </Property>
      </PropertyGroup>

      <Borrowers page={page} />

      <RevisionHistory skill={detail.name} revisions={history.revisions} />
    </PropertiesPanel>
  );
}
