import { useSuspenseQuery } from "@tanstack/react-query";
import { createRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpCircle,
  CircleCheck,
  CircleDashed,
  Clock,
  FileWarning,
  GitFork,
  PenLine,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";
import type { AttentionItem, AttentionReason } from "../api/types.ts";
import { rootRoute } from "../app/root-route.tsx";
import { PageBody, PageHeader, Section } from "../components/layout/page.tsx";
import { ProjectAvatar } from "../components/project-avatar.tsx";
import { Button, buttonStyles } from "../components/ui/button.tsx";
import { EmptyState } from "../components/ui/empty-state.tsx";
import { toneText } from "../components/ui/status.tsx";
import { Tooltip } from "../components/ui/tooltip.tsx";
import { describeAttention } from "../features/attention/describe.ts";
import { attentionQuery } from "../features/attention/queries.ts";
import { LoanMenu } from "../features/loans/loan-menu.tsx";
import { useLoanAction } from "../features/loans/mutations.ts";
import { REASON } from "../features/loans/states.ts";
import { cn } from "../lib/cn.ts";
import { shortDate } from "../lib/format.ts";

export const attentionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  loader: ({ context }) => context.queryClient.ensureQueryData(attentionQuery()),
  component: AttentionPage,
});

const ICONS: Record<AttentionReason, ReactNode> = {
  overdue: <TriangleAlert />,
  diverged: <GitFork />,
  modified: <PenLine />,
  missing: <FileWarning />,
  "due-soon": <Clock />,
  behind: <ArrowUpCircle />,
};

function AttentionPage() {
  const { data: items } = useSuspenseQuery(attentionQuery());
  const groups = groupByReason(items);

  return (
    <>
      <PageHeader crumbs={[{ label: "Attention" }]} />
      <PageBody>
        {items.length === 0 ? (
          <EmptyState icon={<CircleCheck />} title="All caught up">
            Skills renew automatically when agents use them. Anything due soon, edited, or out of
            date shows up here.
          </EmptyState>
        ) : (
          groups.map(([reason, group]) => (
            <Section
              key={reason}
              title={REASON[reason].title}
              count={group.length}
              icon={
                <span className={cn("[&_svg]:size-3.5", toneText(REASON[reason].tone))}>
                  {ICONS[reason]}
                </span>
              }
            >
              {group.map((item) => (
                <AttentionRow key={`${item.project.id}/${item.skill}`} item={item} />
              ))}
            </Section>
          ))
        )}
      </PageBody>
    </>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const reason = item.reasons[0] as AttentionReason;
  return (
    <div className="group flex h-11 items-center gap-3 border-border-subtle border-b px-5 transition-colors hover:bg-surface-hover">
      <span className={cn("[&_svg]:size-4", toneText(REASON[reason].tone))}>{ICONS[reason]}</span>
      <Link
        to="/library/$skillName"
        params={{ skillName: item.skill }}
        className="shrink-0 font-medium text-fg hover:underline"
      >
        {item.skill}
      </Link>
      <Link
        to="/projects/$projectId"
        params={{ projectId: item.project.id }}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[12px] text-fg-muted hover:border-border-strong hover:text-fg"
      >
        <ProjectAvatar name={item.project.name} className="size-3.5 text-[8px]" />
        {item.project.name}
      </Link>
      <span className="min-w-0 flex-1 truncate text-fg-muted">{describeAttention(item)}</span>
      <QuickAction item={item} reason={reason} />
      <Tooltip label={`Due ${new Date(item.dueAt).toLocaleDateString()}`}>
        <span className="w-14 shrink-0 text-right text-[12px] text-fg-subtle tabular-nums">
          {shortDate(item.dueAt)}
        </span>
      </Tooltip>
      <LoanMenu projectId={item.project.id} skill={item.skill} content={item.content} />
    </div>
  );
}

/** The one obvious next step for an item, shown on hover. */
function QuickAction({ item, reason }: { item: AttentionItem; reason: AttentionReason }) {
  const action = useLoanAction();
  const target = { projectId: item.project.id, skill: item.skill };
  const button = (label: string, icon: ReactNode, onClick: () => void) => (
    <Button
      className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      onClick={onClick}
      disabled={action.isPending}
    >
      {icon}
      {label}
    </Button>
  );
  switch (reason) {
    case "due-soon":
      return button("Renew", <RotateCcw />, () =>
        action.mutate({ target, action: { kind: "renew" } }),
      );
    case "behind":
      return button("Update", <ArrowUpCircle />, () =>
        action.mutate({ target, action: { kind: "update" } }),
      );
    default:
      return (
        <Link
          to="/library/$skillName"
          params={{ skillName: item.skill }}
          className={cn(
            buttonStyles(),
            "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
          )}
        >
          <CircleDashed />
          Review
        </Link>
      );
  }
}

function groupByReason(items: readonly AttentionItem[]): [AttentionReason, AttentionItem[]][] {
  const groups = new Map<AttentionReason, AttentionItem[]>();
  for (const item of items) {
    const reason = item.reasons[0] as AttentionReason;
    groups.set(reason, [...(groups.get(reason) ?? []), item]);
  }
  return [...groups];
}
