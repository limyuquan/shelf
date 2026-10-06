import { useSuspenseQuery } from "@tanstack/react-query";
import { createRoute, Link } from "@tanstack/react-router";
import { FolderGit2 } from "lucide-react";
import { rootRoute } from "../app/root-route.tsx";
import { PageBody, PageHeader } from "../components/layout/page.tsx";
import { ProjectAvatar } from "../components/project-avatar.tsx";
import { EmptyState } from "../components/ui/empty-state.tsx";
import { StatusPill } from "../components/ui/status.tsx";
import { projectsQuery } from "../features/projects/queries.ts";
import { shortPath, timeAgo } from "../lib/format.ts";

export const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects",
  loader: ({ context }) => context.queryClient.ensureQueryData(projectsQuery()),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { data: projects } = useSuspenseQuery(projectsQuery());
  return (
    <>
      <PageHeader crumbs={[{ label: "Projects" }]} />
      <PageBody>
        {projects.length === 0 ? (
          <EmptyState icon={<FolderGit2 />} title="No projects yet">
            Run `shelf init` inside a project to start borrowing skills into it.
          </EmptyState>
        ) : (
          projects.map((project) => (
            <Link
              key={project.id}
              to="/projects/$projectId"
              params={{ projectId: project.id }}
              className="flex h-14 items-center gap-4 border-border-subtle border-b px-5 transition-colors hover:bg-surface-hover"
            >
              <ProjectAvatar name={project.name} className="size-6 rounded-md text-[11px]" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-fg">{project.name}</div>
                <div className="truncate font-mono text-[11.5px] text-fg-subtle">
                  {shortPath(project.path)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {project.overdue > 0 && (
                  <StatusPill tone="red">{`${project.overdue} overdue`}</StatusPill>
                )}
                {project.dueSoon > 0 && (
                  <StatusPill tone="yellow">{`${project.dueSoon} due soon`}</StatusPill>
                )}
                {!project.exists && <StatusPill tone="red">missing</StatusPill>}
              </div>
              <span className="w-20 shrink-0 text-right text-[12px] text-fg-muted">
                {project.loans} skill{project.loans === 1 ? "" : "s"}
              </span>
              <span className="w-24 shrink-0 text-right text-[12px] text-fg-subtle">
                {timeAgo(project.lastSeenAt)}
              </span>
            </Link>
          ))
        )}
      </PageBody>
    </>
  );
}
