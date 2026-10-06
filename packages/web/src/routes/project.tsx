import { useSuspenseQuery } from "@tanstack/react-query";
import { createRoute, Link } from "@tanstack/react-router";
import { BookOpen, Copy } from "lucide-react";
import { toast } from "sonner";
import type { Loan } from "../api/types.ts";
import { rootRoute } from "../app/root-route.tsx";
import { PageBody, PageHeader, Section } from "../components/layout/page.tsx";
import { PropertiesPanel, Property, PropertyGroup } from "../components/layout/properties.tsx";
import { ProjectAvatar } from "../components/project-avatar.tsx";
import { IconButton } from "../components/ui/button.tsx";
import { EmptyState } from "../components/ui/empty-state.tsx";
import { StatusPill, toneText } from "../components/ui/status.tsx";
import { Tooltip } from "../components/ui/tooltip.tsx";
import { Timeline } from "../features/activity/timeline.tsx";
import { LoanMenu } from "../features/loans/loan-menu.tsx";
import { CONTENT, DUE } from "../features/loans/states.ts";
import { projectQuery } from "../features/projects/queries.ts";
import { cn } from "../lib/cn.ts";
import { dueLabel, shortDate, shortPath, timeAgo } from "../lib/format.ts";

export const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId",
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(projectQuery(params.projectId)),
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = projectRoute.useParams();
  const { data } = useSuspenseQuery(projectQuery(projectId));
  const { project, loans } = data.report;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Projects", to: "/projects" }, { label: project.name }]}
        actions={
          <Tooltip label="Copy project path">
            <IconButton
              label="Copy project path"
              onClick={() => {
                void navigator.clipboard.writeText(project.path);
                toast.success("Copied the project path");
              }}
            >
              <Copy />
            </IconButton>
          </Tooltip>
        }
      />
      <div className="flex min-h-0 flex-1">
        <PageBody>
          <div className="flex items-center gap-3 px-5 pt-7 pb-5">
            <ProjectAvatar name={project.name} className="size-8 rounded-lg text-[14px]" />
            <div>
              <h1 className="font-semibold text-[20px] text-fg tracking-tight">{project.name}</h1>
              <p className="font-mono text-[12px] text-fg-subtle">{shortPath(project.path)}</p>
            </div>
          </div>
          <Section title="Borrowed skills" count={loans.length}>
            {loans.length === 0 ? (
              <EmptyState icon={<BookOpen />} title="No skills borrowed">
                Agents borrow skills with `shelf borrow`; find some in the Library.
              </EmptyState>
            ) : (
              loans.map((loan) => <LoanRow key={loan.skill} loan={loan} projectId={project.id} />)
            )}
          </Section>
        </PageBody>
        <PropertiesPanel>
          <PropertyGroup title="Details">
            <Property label="Skills">{loans.length}</Property>
            <Property label="Due soon">
              {loans.filter((loan) => loan.due === "due-soon").length}
            </Property>
            <Property label="Location">
              <span className="font-mono text-[12px] text-fg-muted" title={project.path}>
                {shortPath(project.path)}
              </span>
            </Property>
          </PropertyGroup>
          <PropertyGroup title="Activity">
            <Timeline events={data.events.slice(0, 30)} showProject={false} compact />
          </PropertyGroup>
        </PropertiesPanel>
      </div>
    </>
  );
}

function LoanRow({ loan, projectId }: { loan: Loan; projectId: string }) {
  const content = CONTENT[loan.content];
  const due = DUE[loan.due];
  return (
    <div className="flex h-11 items-center gap-4 border-border-subtle border-b px-5 transition-colors hover:bg-surface-hover">
      <Link
        to="/library/$skillName"
        params={{ skillName: loan.skill }}
        className="min-w-0 flex-1 truncate font-medium text-fg hover:underline"
      >
        {loan.skill}
      </Link>
      <Tooltip label={content.help}>
        <span>
          <StatusPill tone={content.tone}>{content.label}</StatusPill>
        </span>
      </Tooltip>
      <span
        className={cn("w-28 shrink-0 text-right text-[12px]", toneText(due.tone))}
        title={`Due ${shortDate(loan.dueAt)}`}
      >
        {dueLabel(loan.daysLeft)}
      </span>
      <span className="w-28 shrink-0 text-right text-[12px] text-fg-subtle">
        {loan.lastUsedAt ? `used ${timeAgo(loan.lastUsedAt)}` : "never used"}
      </span>
      <LoanMenu projectId={projectId} skill={loan.skill} content={loan.content} />
    </div>
  );
}
