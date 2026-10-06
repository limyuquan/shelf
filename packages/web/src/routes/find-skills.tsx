import { useQuery } from "@tanstack/react-query";
import { createRoute, useNavigate } from "@tanstack/react-router";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  FolderSearch,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { z } from "zod";
import { ApiError } from "../api/client.ts";
import { rootRoute } from "../app/root-route.tsx";
import { PageBody, PageHeader } from "../components/layout/page.tsx";
import { Button } from "../components/ui/button.tsx";
import { EmptyState } from "../components/ui/empty-state.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { AdoptBar } from "../features/scan/adopt-bar.tsx";
import { AdoptResults } from "../features/scan/adopt-results.tsx";
import { scanQuery, useAdopt } from "../features/scan/queries.ts";
import { ScanGroup } from "../features/scan/scan-group.tsx";
import {
  adoptionOrder,
  expandTilde,
  plural,
  pruneSelection,
  sortGroups,
  tildePath,
  toggleItems,
} from "../features/scan/select.ts";

const DEPTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const DEFAULT_DEPTH = 6;

export const findSkillsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/find-skills",
  // The folder and depth live in the URL, so a reload repeats the same scan.
  validateSearch: z.object({
    root: z.string().optional(),
    depth: z.number().int().min(1).max(10).optional(),
  }),
  component: FindSkillsPage,
});

/**
 * Finds skill folders copied into projects by hand and adopts them: the library
 * gets each skill, and each project's copy becomes a loan.
 */
function FindSkillsPage() {
  const search = findSkillsRoute.useSearch();
  const navigate = useNavigate({ from: findSkillsRoute.fullPath });
  // No loader: a scan takes seconds, so the page renders first and shows progress.
  const scan = useQuery(scanQuery(search));
  const adopt = useAdopt();
  const home = scan.data?.home ?? "";

  // The folder field shows the scanned folder until the user types in it.
  const [draft, setDraft] = useState<string | null>(null);
  const [depth, setDepth] = useState(search.depth ?? DEFAULT_DEPTH);
  const folder = draft ?? (scan.data ? tildePath(scan.data.root, home) : (search.root ?? ""));

  const groups = useMemo(() => sortGroups(scan.data?.report.groups ?? []), [scan.data]);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const selected = useMemo(() => pruneSelection(picked, groups), [picked, groups]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [unedited, setUnedited] = useState(false);

  const runScan = (event: FormEvent) => {
    event.preventDefault();
    const typed = folder.trim();
    // Expanded here when known so the URL is canonical; the server expands `~` too.
    const root = typed ? (home ? expandTilde(typed, home) : typed) : undefined;
    const next = {
      ...(root ? { root } : {}),
      ...(depth !== DEFAULT_DEPTH ? { depth } : {}),
    };
    setDraft(null);
    if (next.root === (scan.data?.root ?? search.root) && next.depth === search.depth) {
      void scan.refetch();
    } else {
      void navigate({ search: next, replace: true });
    }
  };

  const runAdopt = () =>
    adopt.mutate(
      { paths: adoptionOrder(groups, selected), unedited },
      { onSuccess: () => setPicked(new Set()) },
    );

  const scanning = scan.isFetching;
  const root = scan.data ? tildePath(scan.data.root, home) : (search.root ?? "your projects");

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Library", to: "/library" }, { label: "Find existing skills" }]}
      />
      <form
        onSubmit={runScan}
        className="flex shrink-0 flex-wrap items-center gap-2 border-border-subtle border-b px-4 py-2.5 md:flex-nowrap md:px-5"
      >
        <label className="flex h-8 min-w-0 flex-1 basis-full items-center gap-2 rounded-md border border-border bg-surface px-2.5 focus-within:border-border-strong md:basis-auto pointer-coarse:h-10">
          <FolderSearch className="size-3.5 shrink-0 text-fg-subtle" />
          <span className="sr-only">Folder to scan</span>
          <input
            value={folder}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Folder that holds your projects"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="h-full min-w-0 flex-1 bg-transparent font-mono text-[12.5px] text-fg outline-none placeholder:font-sans placeholder:text-fg-subtle pointer-coarse:text-[16px]"
          />
        </label>
        <label className="flex h-8 items-center gap-2 rounded-md border border-border bg-surface pl-2.5 text-[12.5px] text-fg-muted max-md:flex-1 pointer-coarse:h-10">
          Depth
          <select
            value={depth}
            onChange={(event) => setDepth(Number(event.target.value))}
            className="h-full flex-1 bg-transparent pr-2 text-fg outline-none pointer-coarse:text-[16px]"
          >
            {DEPTHS.map((value) => (
              <option key={value} value={value}>
                {value} level{value === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="primary" size="md" disabled={scanning}>
          {scanning ? <LoaderCircle className="animate-spin" /> : <FolderSearch />}
          {scanning ? "Scanning…" : "Scan"}
        </Button>
      </form>

      <PageBody>
        {adopt.data && (
          <AdoptResults results={adopt.data} home={home} onDismiss={() => adopt.reset()} />
        )}
        {scan.isPending ? (
          <div className="flex flex-col gap-2 p-4 md:p-5" aria-busy="true">
            <p className="mb-2 flex items-center gap-2 text-[13px] text-fg-muted">
              <LoaderCircle className="size-3.5 animate-spin" />
              Scanning {root} for skill folders. This can take a few seconds.
            </p>
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-12" />
            ))}
          </div>
        ) : scan.isError ? (
          <EmptyState icon={<TriangleAlert />} title="Couldn't scan that folder">
            {scan.error.message}
            {scan.error instanceof ApiError && scan.error.hint && (
              <span className="mt-1 block text-fg-subtle">{scan.error.hint}</span>
            )}
          </EmptyState>
        ) : groups.length === 0 ? (
          <EmptyState icon={<FolderSearch />} title={`No skill copies found under ${root}`}>
            shelf looks for folders with a SKILL.md inside a <code>skills</code> directory. Try
            another folder or a greater depth.
          </EmptyState>
        ) : (
          <>
            <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-border-subtle border-b px-4 py-2 md:px-5">
              <p className="min-w-0 flex-1 text-[12.5px] text-fg-muted max-md:basis-full">
                {plural(groups.length, "skill")},{" "}
                {plural(
                  groups.reduce((total, group) => total + group.copies, 0),
                  "copy",
                  "copies",
                )}{" "}
                under <span className="font-mono text-fg">{root}</span>
              </p>
              <Button
                variant="ghost"
                className="max-md:-ml-3"
                onClick={() =>
                  setExpanded(
                    expanded.size === groups.length
                      ? new Set()
                      : new Set(groups.map((group) => group.name)),
                  )
                }
              >
                {expanded.size === groups.length ? <ChevronsDownUp /> : <ChevronsUpDown />}
                {expanded.size === groups.length ? "Collapse all" : "Expand all"}
              </Button>
              <Button variant="ghost" onClick={() => void scan.refetch()} disabled={scanning}>
                <RefreshCw className={scanning ? "animate-spin" : undefined} />
                Rescan
              </Button>
            </div>
            {groups.map((group) => (
              <ScanGroup
                key={group.name}
                group={group}
                home={home}
                expanded={expanded.has(group.name)}
                onExpandedChange={(open) => setExpanded(toggleItems(expanded, [group.name], open))}
                selected={selected}
                onSelect={(paths, on) => setPicked(toggleItems(selected, paths, on))}
              />
            ))}
          </>
        )}
      </PageBody>

      {selected.size > 0 && (
        <AdoptBar
          count={selected.size}
          unedited={unedited}
          onUneditedChange={setUnedited}
          onAdopt={runAdopt}
          onClear={() => setPicked(new Set())}
          pending={adopt.isPending}
        />
      )}
    </>
  );
}
