import { useQuery } from "@tanstack/react-query";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, FolderSearch, Link2, Search } from "lucide-react";
import { useRef } from "react";
import { z } from "zod";
import { rootRoute } from "../app/root-route.tsx";
import { PageBody, PageHeader } from "../components/layout/page.tsx";
import { buttonStyles } from "../components/ui/button.tsx";
import { EmptyState } from "../components/ui/empty-state.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { Tooltip } from "../components/ui/tooltip.tsx";
import { useContentSearch } from "../features/search/queries.ts";
import { SearchResults } from "../features/search/search-results.tsx";
import { SetsSection } from "../features/sets/sets-section.tsx";
import { skillsQuery } from "../features/skills/queries.ts";
import { cn } from "../lib/cn.ts";
import { sourceLabel } from "../lib/format.ts";
import { navigableRow, useHotkeys, useListNavigation } from "../lib/hotkeys.ts";

export const libraryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/library",
  validateSearch: z.object({ q: z.string().optional() }),
  // Filtering searches skill content (debounced, in the component), not the catalog.
  loader: ({ context }) => context.queryClient.ensureQueryData(skillsQuery()),
  component: LibraryPage,
});

function LibraryPage() {
  const { q = "" } = libraryRoute.useSearch();
  const navigate = useNavigate({ from: libraryRoute.fullPath });
  const skills = useQuery(skillsQuery());
  // With a filter, the list shows content search results once the first ones arrive.
  const { results } = useContentSearch(q);
  const searching = q.trim() !== "" && results !== undefined;
  const filter = useRef<HTMLInputElement>(null);
  useHotkeys({ "/": () => filter.current?.focus() });
  const { rowProps } = useListNavigation<{ name: string }>(
    searching ? results : (skills.data ?? []),
    {
      onOpen: (skill) =>
        void navigate({ to: "/library/$skillName", params: { skillName: skill.name } }),
    },
  );

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Library" }]}
        actions={
          <Link to="/find-skills" aria-label="Find existing skills" className={buttonStyles()}>
            <FolderSearch />
            <span className="max-sm:hidden">Find existing skills</span>
          </Link>
        }
      />
      <div className="flex h-11 shrink-0 items-center gap-2.5 border-border-subtle border-b px-4 md:px-5 pointer-coarse:h-12">
        <Search className="size-3.5 text-fg-subtle" />
        <input
          ref={filter}
          value={q}
          onKeyDown={(event) => event.key === "Escape" && event.currentTarget.blur()}
          onChange={(event) =>
            void navigate({
              search: event.target.value ? { q: event.target.value } : {},
              replace: true,
            })
          }
          placeholder="Search skills and their content"
          className="h-full flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
        />
        {searching ? (
          <span className="text-[12px] text-fg-subtle">
            {results.length} match{results.length === 1 ? "" : "es"}
          </span>
        ) : (
          skills.data && (
            <span className="text-[12px] text-fg-subtle">{skills.data.length} skills</span>
          )
        )}
      </div>
      <PageBody>
        {!q.trim() && Boolean(skills.data?.length) && <SetsSection />}
        {searching ? (
          <SearchResults results={results} rowProps={rowProps} />
        ) : !skills.data ? (
          <div className="flex flex-col gap-2 p-5">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : skills.data.length === 0 ? (
          <EmptyState
            icon={<BookOpen />}
            title={q ? "No matching skills" : "Your library is empty"}
          >
            {q ? (
              "Try another search."
            ) : (
              <>
                <p>
                  Create one with `shelf new`, or bring in skills already copied into your projects.
                </p>
                <Link
                  to="/find-skills"
                  className={cn(buttonStyles({ variant: "primary", size: "md" }), "mt-4")}
                >
                  <FolderSearch />
                  Find existing skills
                </Link>
              </>
            )}
          </EmptyState>
        ) : (
          skills.data.map((skill, index) => (
            <Link
              key={skill.name}
              to="/library/$skillName"
              params={{ skillName: skill.name }}
              {...rowProps(index)}
              className={cn(
                "flex items-center gap-4 border-border-subtle border-b px-4 py-3 transition-colors hover:bg-surface-hover md:h-14 md:px-5 md:py-0",
                navigableRow,
              )}
            >
              <BookOpen className="size-4 shrink-0 self-start text-fg-subtle max-md:mt-0.5 md:self-auto" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-fg">{skill.name}</span>
                  {skill.source && (
                    <Tooltip label={`Linked to ${sourceLabel(skill.source)}`}>
                      <Link2 className="size-3.5 text-fg-subtle" />
                    </Tooltip>
                  )}
                </div>
                <p className="text-[12.5px] text-fg-muted max-md:line-clamp-2 md:truncate">
                  {skill.description}
                </p>
                <p className="mt-1 text-[12px] text-fg-subtle md:hidden">
                  {skill.borrowers} project{skill.borrowers === 1 ? "" : "s"} · ~
                  {skill.tokens.toLocaleString()} tokens
                </p>
              </div>
              <span className="hidden w-24 shrink-0 text-right text-[12px] text-fg-muted md:block">
                {skill.borrowers} project{skill.borrowers === 1 ? "" : "s"}
              </span>
              <span className="hidden w-20 shrink-0 text-right text-[12px] text-fg-subtle tabular-nums md:block">
                ~{skill.tokens.toLocaleString()} tok
              </span>
            </Link>
          ))
        )}
      </PageBody>
    </>
  );
}
