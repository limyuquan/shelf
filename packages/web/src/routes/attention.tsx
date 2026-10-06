import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowUpCircle,
  CircleCheck,
  Clock,
  FileDiff,
  FileWarning,
  GitFork,
  PenLine,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { type ReactNode, useState } from "react";
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
import { ChangesDialog } from "../features/loans/changes-dialog.tsx";
import { LoanMenu } from "../features/loans/loan-menu.tsx";
import { useLoanAction, useSync } from "../features/loans/mutations.ts";
import { REASON } from "../features/loans/states.ts";
import { brokenHooks } from "../features/system/hook-label.ts";
import { systemQuery } from "../features/system/queries.ts";
import { cn } from "../lib/cn.ts";
import { shortDate } from "../lib/format.ts";
import { navigableRow, useListNavigation } from "../lib/hotkeys.ts";

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

const reasonOf = (item: AttentionItem) => item.reasons[0] as AttentionReason;
const hasChanges = (item: AttentionItem) =>
  item.content === "modified" || item.content === "diverged" || item.content === "behind";

function AttentionPage() {
  const { data: items } = useSuspenseQuery(attentionQuery());
  const navigate = useNavigate();
  const action = useLoanAction();
  const [reviewing, setReviewing] = useState<AttentionItem | null>(null);
  const groups = groupByReason(items);
  const ordered = groups.flatMap(([, group]) => group);
  const target = (item: AttentionItem) => ({ projectId: item.project.id, skill: item.skill });

  const { rowProps } = useListNavigation(ordered, {
    onOpen: (item) =>
      void navigate({ to: "/library/$skillName", params: { skillName: item.skill } }),
    keys: {
      r: (item) => action.mutate({ target: target(item), action: { kind: "renew" } }),
      u: (item) =>
        item.content === "behind" &&
        action.mutate({ target: target(item), action: { kind: "update" } }),
      c: (item) => hasChanges(item) && setReviewing(item),
    },
  });

  return (
    <>
      <PageHeader crumbs={[{ label: "Attention" }]} />
      <PageBody>
        <HooksBanner />
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
                <AttentionRow
                  key={`${item.project.id}/${item.skill}`}
                  item={item}
                  onReview={() => setReviewing(item)}
                  {...rowProps(ordered.indexOf(item))}
                />
              ))}
            </Section>
          ))
        )}
      </PageBody>
      {reviewing && (
        <ChangesDialog
          open
          onOpenChange={(open) => !open && setReviewing(null)}
          projectId={reviewing.project.id}
          projectName={reviewing.project.name}
          skill={reviewing.skill}
          content={reviewing.content}
        />
      )}
    </>
  );
}

function AttentionRow({
  item,
  onReview,
  ...nav
}: {
  item: AttentionItem;
  onReview: () => void;
} & ReturnType<ReturnType<typeof useListNavigation>["rowProps"]>) {
  const reason = reasonOf(item);
  return (
    <div
      {...nav}
      className={cn(
        "group flex h-11 items-center gap-3 border-border-subtle border-b px-5 transition-colors hover:bg-surface-hover",
        navigableRow,
      )}
    >
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
      <QuickAction item={item} onReview={onReview} />
      <Tooltip label={`Due ${new Date(item.dueAt).toLocaleDateString()}`}>
        <span className="w-14 shrink-0 text-right text-[12px] text-fg-subtle tabular-nums">
          {shortDate(item.dueAt)}
        </span>
      </Tooltip>
      <LoanMenu
        projectId={item.project.id}
        projectName={item.project.name}
        skill={item.skill}
        content={item.content}
      />
    </div>
  );
}

const revealed =
  "opacity-0 transition-opacity group-hover:opacity-100 group-data-[active=true]:opacity-100 focus-visible:opacity-100";

/** The one obvious next step for an item, shown on hover or when selected. */
function QuickAction({ item, onReview }: { item: AttentionItem; onReview: () => void }) {
  const action = useLoanAction();
  const sync = useSync();
  const target = { projectId: item.project.id, skill: item.skill };
  const button = (label: string, icon: ReactNode, onClick: () => void, pending = false) => (
    <Button className={revealed} onClick={onClick} disabled={pending}>
      {icon}
      {label}
    </Button>
  );
  if (item.content === "missing") {
    return button("Sync", <RefreshCw />, () => sync.mutate(item.project.id), sync.isPending);
  }
  if (hasChanges(item) && reasonOf(item) !== "due-soon") {
    return button("Review", <FileDiff />, onReview);
  }
  if (reasonOf(item) === "due-soon") {
    return button(
      "Renew",
      <RotateCcw />,
      () => action.mutate({ target, action: { kind: "renew" } }),
      action.isPending,
    );
  }
  return null;
}

/** Without hooks, skills only renew when an agent remembers to: say so up front. */
function HooksBanner() {
  const system = useQuery(systemQuery());
  const broken = system.data ? brokenHooks(system.data.hooks) : [];
  if (broken.length === 0) return null;
  return (
    <div className="flex items-center gap-3 border-border-subtle border-b bg-yellow/5 px-5 py-2.5 text-[13px]">
      <TriangleAlert className="size-4 shrink-0 text-yellow" />
      <span className="flex-1 text-fg-muted">
        <span className="text-fg">
          {broken.map((hook) => hook.label).join(" and ")} {broken.length === 1 ? "has" : "have"} no
          shelf hooks.
        </span>{" "}
        Skills used there won't renew automatically.
      </span>
      <Link to="/settings" className={buttonStyles()}>
        Fix in settings
      </Link>
    </div>
  );
}

function groupByReason(items: readonly AttentionItem[]): [AttentionReason, AttentionItem[]][] {
  const groups = new Map<AttentionReason, AttentionItem[]>();
  for (const item of items) {
    const reason = reasonOf(item);
    groups.set(reason, [...(groups.get(reason) ?? []), item]);
  }
  return [...groups];
}
