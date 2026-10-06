import { useSuspenseQuery } from "@tanstack/react-query";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, Copy, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import type { Loan } from "../api/types.ts";
import { rootRoute } from "../app/root-route.tsx";
import { PageBody, PageHeader, Section } from "../components/layout/page.tsx";
import { PropertiesPanel, Property, PropertyGroup } from "../components/layout/properties.tsx";
import { ProjectAvatar } from "../components/project-avatar.tsx";
import { Button, IconButton } from "../components/ui/button.tsx";
import { EmptyState } from "../components/ui/empty-state.tsx";
import { Kbd } from "../components/ui/kbd.tsx";
import { StatusPill, toneText } from "../components/ui/status.tsx";
import { Tooltip } from "../components/ui/tooltip.tsx";
import { Timeline } from "../features/activity/timeline.tsx";
import { BorrowDialog } from "../features/loans/borrow-dialog.tsx";
import { ChangesDialog } from "../features/loans/changes-dialog.tsx";
import { LoanMenu } from "../features/loans/loan-menu.tsx";
import { useLoanAction } from "../features/loans/mutations.ts";
import { CONTENT, DUE } from "../features/loans/states.ts";
import { projectQuery } from "../features/projects/queries.ts";
import { cn } from "../lib/cn.ts";
import { dueLabel, shortDate, shortPath, timeAgo } from "../lib/format.ts";
import { navigableRow, useHotkeys, useListNavigation } from "../lib/hotkeys.ts";

export const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId",
  // `?borrow` opens the borrow dialog, so ⌘K can link straight to it.
  validateSearch: z.object({ borrow: z.boolean().optional() }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(projectQuery(params.projectId)),
  component: ProjectPage,
});

const hasChanges = (loan: Loan) =>
  loan.content === "modified" || loan.content === "diverged" || loan.content === "behind";

function ProjectPage() {
  const { projectId } = projectRoute.useParams();
  const { borrow: borrowing = false } = projectRoute.useSearch();
  const navigate = useNavigate({ from: projectRoute.fullPath });
  const { data } = useSuspenseQuery(projectQuery(projectId));
  const { project, loans } = data.report;
  const action = useLoanAction();
  const [reviewing, setReviewing] = useState<Loan | null>(null);
  const setBorrowing = (open: boolean) =>
    void navigate({ search: open ? { borrow: true } : {}, replace: true });
  const target = (loan: Loan) => ({ projectId: project.id, skill: loan.skill });

  useHotkeys({ b: () => setBorrowing(true) });
  const { rowProps } = useListNavigation(loans, {
    onOpen: (loan) =>
      void navigate({ to: "/library/$skillName", params: { skillName: loan.skill } }),
    keys: {
      r: (loan) => action.mutate({ target: target(loan), action: { kind: "renew" } }),
      u: (loan) =>
        loan.content === "behind" &&
        action.mutate({ target: target(loan), action: { kind: "update" } }),
      c: (loan) => hasChanges(loan) && setReviewing(loan),
    },
  });

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Projects", to: "/projects" }, { label: project.name }]}
        actions={
          <>
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
            <Button variant="primary" onClick={() => setBorrowing(true)}>
              <Plus />
              Borrow skills
              <Kbd className="border-white/25 bg-white/10 text-white/80">B</Kbd>
            </Button>
          </>
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
                Borrow skills from your library, or let agents borrow them with `shelf borrow`.
              </EmptyState>
            ) : (
              loans.map((loan, index) => (
                <LoanRow
                  key={loan.skill}
                  loan={loan}
                  projectId={project.id}
                  projectName={project.name}
                  onReview={() => setReviewing(loan)}
                  {...rowProps(index)}
                />
              ))
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
      <BorrowDialog
        open={borrowing}
        onOpenChange={setBorrowing}
        projectId={project.id}
        projectName={project.name}
        borrowed={loans.map((loan) => loan.skill)}
      />
      {reviewing && (
        <ChangesDialog
          open
          onOpenChange={(open) => !open && setReviewing(null)}
          projectId={project.id}
          projectName={project.name}
          skill={reviewing.skill}
          content={reviewing.content}
        />
      )}
    </>
  );
}

function LoanRow({
  loan,
  projectId,
  projectName,
  onReview,
  ...nav
}: {
  loan: Loan;
  projectId: string;
  projectName: string;
  onReview: () => void;
} & ReturnType<ReturnType<typeof useListNavigation>["rowProps"]>) {
  const content = CONTENT[loan.content];
  const due = DUE[loan.due];
  const pill = <StatusPill tone={content.tone}>{content.label}</StatusPill>;
  return (
    <div
      {...nav}
      className={cn(
        "flex h-11 items-center gap-4 border-border-subtle border-b px-5 transition-colors hover:bg-surface-hover",
        navigableRow,
      )}
    >
      <Link
        to="/library/$skillName"
        params={{ skillName: loan.skill }}
        className="min-w-0 flex-1 truncate font-medium text-fg hover:underline"
      >
        {loan.skill}
      </Link>
      <Tooltip label={hasChanges(loan) ? `${content.help} — click to review` : content.help}>
        {hasChanges(loan) ? (
          <button type="button" onClick={onReview} className="rounded-full hover:brightness-125">
            {pill}
          </button>
        ) : (
          <span>{pill}</span>
        )}
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
      <LoanMenu
        projectId={projectId}
        projectName={projectName}
        skill={loan.skill}
        content={loan.content}
      />
    </div>
  );
}
