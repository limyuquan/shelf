import { useSuspenseQuery } from "@tanstack/react-query";
import { createRoute } from "@tanstack/react-router";
import { Copy, FileText, GitBranch, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { SkillPage as SkillPageData } from "../api/types.ts";
import { rootRoute } from "../app/root-route.tsx";
import { PageBody, PageHeader } from "../components/layout/page.tsx";
import { PropertiesPanel, Property, PropertyGroup } from "../components/layout/properties.tsx";
import { Button, IconButton } from "../components/ui/button.tsx";
import { Kbd } from "../components/ui/kbd.tsx";
import { Tooltip } from "../components/ui/tooltip.tsx";
import { Borrowers } from "../features/skills/borrowers.tsx";
import { skillQuery, useSaveSkill } from "../features/skills/queries.ts";
import { SkillEditor } from "../features/skills/skill-editor.tsx";
import { shortDate, shortHash, shortPath, sourceLabel } from "../lib/format.ts";

export const skillRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/library/$skillName",
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(skillQuery(params.skillName)),
  component: SkillPage,
});

function SkillPage() {
  const { skillName } = skillRoute.useParams();
  const { data: page } = useSuspenseQuery(skillQuery(skillName));
  const { detail } = page;
  const [draft, setDraft] = useState(detail.content);
  const save = useSaveSkill(skillName);
  const dirty = draft !== detail.content;

  // A refetch after saving (or an edit elsewhere) brings new content: adopt it.
  useEffect(() => setDraft(detail.content), [detail.content]);

  const onSave = () => {
    if (draft !== detail.content && !save.isPending) save.mutate(draft);
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Library", to: "/library" }, { label: detail.name }]}
        actions={
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
        }
      />
      <div className="flex min-h-0 flex-1">
        <PageBody className="relative">
          <div className="mx-auto max-w-[820px] px-10 pt-9 pb-24">
            <h1 className="font-semibold text-[22px] text-fg tracking-tight">{detail.name}</h1>
            <p className="mt-2 max-w-[640px] text-[14px] text-fg-muted leading-relaxed">
              {detail.description}
            </p>

            <div className="mt-7 flex items-center gap-2 border-border-subtle border-b pb-2.5">
              <span className="flex items-center gap-1.5 font-medium text-[12.5px] text-fg">
                <FileText className="size-3.5 text-fg-muted" />
                SKILL.md
              </span>
              <span className="text-[12px] text-fg-subtle">
                ~{detail.tokens.toLocaleString()} tokens when loaded
              </span>
            </div>
            <div className="-mx-2 mt-1">
              <SkillEditor value={draft} onChange={setDraft} onSave={onSave} />
            </div>
          </div>

          {dirty && (
            <div className="-translate-x-1/2 sticky bottom-5 left-1/2 z-20 flex w-fit items-center gap-3 rounded-lg bg-surface-overlay py-1.5 pr-1.5 pl-3.5 shadow-popup">
              <span className="text-[13px] text-fg-muted">Unsaved changes</span>
              <Button variant="ghost" onClick={() => setDraft(detail.content)}>
                Discard
              </Button>
              <Button variant="primary" onClick={onSave} disabled={save.isPending}>
                Save <Kbd className="border-white/25 bg-white/10 text-white/80">⌘S</Kbd>
              </Button>
            </div>
          )}
        </PageBody>
        <SkillProperties page={page} />
      </div>
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

      <PropertyGroup title="History">
        {history.revisions.map((revision) => (
          <div key={revision.hash} className="flex h-8 items-center gap-2.5 text-[13px]">
            <GitBranch className="size-3.5 text-fg-subtle" />
            <code className="font-mono text-[12px] text-fg">{shortHash(revision.hash)}</code>
            <span className="text-fg-muted">{revision.source}</span>
            {revision.latest && (
              <span className="rounded-full bg-accent-soft px-1.5 text-[11px] text-accent">
                latest
              </span>
            )}
            <span className="ml-auto text-[12px] text-fg-subtle">
              {shortDate(revision.createdAt)}
            </span>
          </div>
        ))}
      </PropertyGroup>

      {detail.files.length > 1 && (
        <PropertyGroup title={`Files ${detail.files.length}`}>
          {detail.files.map((file) => (
            <div key={file} className="flex h-7 items-center gap-2 text-[12.5px] text-fg-muted">
              <FileText className="size-3.5 shrink-0 text-fg-subtle" />
              <span className="truncate">{file}</span>
            </div>
          ))}
        </PropertyGroup>
      )}
    </PropertiesPanel>
  );
}
