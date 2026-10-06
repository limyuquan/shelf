import { useSuspenseQuery } from "@tanstack/react-query";
import { createRoute } from "@tanstack/react-router";
import { ChartColumn } from "lucide-react";
import type { ReactNode } from "react";
import { rootRoute } from "../app/root-route.tsx";
import { PageBody, PageHeader } from "../components/layout/page.tsx";
import { EmptyState } from "../components/ui/empty-state.tsx";
import { ActivityChart } from "../features/insights/charts.tsx";
import { ContextBudget } from "../features/insights/context-budget.tsx";
import { formatTokens, plural, summarize } from "../features/insights/describe.ts";
import { GlobalSkills } from "../features/insights/global-skills.tsx";
import { insightsQuery } from "../features/insights/queries.ts";
import { SkillsTable } from "../features/insights/skills-table.tsx";

export const insightsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/insights",
  loader: ({ context }) => context.queryClient.ensureQueryData(insightsQuery()),
  component: InsightsPage,
});

function InsightsPage() {
  const { data } = useSuspenseQuery(insightsQuery());
  const summary = summarize(data);
  const empty = data.skills.length === 0 && data.projects.length === 0;

  return (
    <>
      <PageHeader crumbs={[{ label: "Insights" }]} />
      <PageBody>
        {empty && data.globalSkills.length === 0 ? (
          <EmptyState icon={<ChartColumn />} title="Nothing to measure yet">
            Add skills to your library and borrow them into a project to see what they cost and how
            often agents use them.
          </EmptyState>
        ) : (
          <div className="mx-auto flex max-w-[1040px] flex-col gap-9 px-4 py-6 md:px-8">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile
                label="Skills in library"
                value={String(summary.skills)}
                note={`${data.skills.filter((skill) => skill.borrowers > 0).length} borrowed`}
              />
              <Tile
                label="Active loans"
                value={String(summary.activeLoans)}
                note={`across ${plural(summary.projects, "project")}`}
              />
              <Tile
                label="Median session context"
                value={`~${formatTokens(summary.medianSession)}`}
                note="tokens per project"
              />
              <Tile
                label="Unused in 30 days"
                value={String(summary.unused)}
                note={`${summary.neverUsed} never used`}
              />
            </div>

            <Block
              title="Context at session start"
              description="Every session loads the name and description of each available skill. The full SKILL.md loads only when a skill is used."
            >
              {data.projects.length === 0 ? (
                <Empty>No projects yet. Run `shelf init` in one to start borrowing.</Empty>
              ) : (
                <ContextBudget projects={data.projects} globalSkills={data.globalSkills} />
              )}
            </Block>

            <Block
              title="Skills active per day"
              description="Distinct skills agents used each day, across all projects."
            >
              <ActivityChart
                days={data.usage.days}
                active={data.usage.active}
                skills={data.skills}
              />
            </Block>

            <Block
              title="Skills"
              description="Session cost is the description, loaded in every borrowing project; body is the SKILL.md, loaded on use."
            >
              {data.skills.length === 0 ? (
                <Empty>Your library is empty.</Empty>
              ) : (
                <SkillsTable skills={data.skills} />
              )}
            </Block>

            <Block
              title="Loaded everywhere"
              description={`User-level skills load in every session of every project${
                summary.globalTokens > 0
                  ? `: ~${formatTokens(summary.globalTokens)} tokens each time`
                  : ""
              }. Borrowing them only where they are needed saves that cost elsewhere.`}
            >
              <GlobalSkills skills={data.globalSkills} invalid={data.invalidGlobalSkills} />
            </Block>
          </div>
        )}
      </PageBody>
    </>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised px-4 py-3">
      <div className="text-[12px] text-fg-muted">{label}</div>
      <div className="mt-1 font-semibold text-[22px] text-fg leading-tight">{value}</div>
      <div className="mt-0.5 truncate text-[12px] text-fg-subtle">{note}</div>
    </div>
  );
}

function Block({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="font-medium text-[14px] text-fg">{title}</h2>
      <p className="mt-0.5 mb-3 max-w-[640px] text-[12.5px] text-fg-muted">{description}</p>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-border border-dashed px-4 py-6 text-center text-[12.5px] text-fg-muted">
      {children}
    </p>
  );
}
