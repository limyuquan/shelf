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
import { BulkBar, SelectAllBox, SelectBox } from "../features/loans/bulk-bar.tsx";
import { ChangesDialog } from "../features/loans/changes-dialog.tsx";
import { LoanMenu } from "../features/loans/loan-menu.tsx";
import { useLoanAction, useSync } from "../features/loans/mutations.ts";
import { REASON } from "../features/loans/states.ts";
import { useSelection } from "../features/loans/use-selection.ts";
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

/** Rows span projects, so a skill alone doesn't identify one. */
const keyOf = (item: AttentionItem) => `${item.project.id}/${item.skill}`;
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
  const selection = useSelection(ordered, keyOf);

  const { rowProps } = useListNavigation(ordered, {
    onOpen: (item) =>
      void navigate({ to: "/library/$skillName", params: { skillName: item.skill } }),
    keys: {
      r: (item) => action.mutate({ target: target(item), action: { kind: "renew" } }),
      u: (item) =>
        item.content === "behind" &&
        action.mutate({ target: target(item), action: { kind: "update" } }),
      c: (item) => hasChanges(item) && setReviewing(item),
      x: (item) => selection.toggle(item),
    },
    onEscape: () => {
      if (selection.size === 0) return false;
      selection.clear();
      return true;
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
                <>
                  <SelectAllBox
                    label={`Select every ${REASON[reason].title.toLowerCase()} item`}
                    selection={selection}
                    items={group}
                    className="-mr-0.5 pointer-coarse:mr-1"
                  />
                  <span className={cn("[&_svg]:size-3.5", toneText(REASON[reason].tone))}>
                    {ICONS[reason]}
                  </span>
                </>
              }
            >
              {group.map((item) => (
                <AttentionRow
                  key={keyOf(item)}
                  item={item}
                  onReview={() => setReviewing(item)}
                  selected={selection.has(item)}
                  selecting={selection.size > 0}
                  onSelect={(range) => selection.toggle(item, range)}
                  {...rowProps(ordered.indexOf(item))}
                />
              ))}
            </Section>
          ))
        )}
      </PageBody>
      {selection.size > 0 && (
        <BulkBar
          selection={selection}
          target={(item) => ({
            ...target(item),
            key: keyOf(item),
            label: `${item.skill} in ${item.project.name}`,
          })}
        />
      )}
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
  selected,
  selecting,
  onSelect,
  ...nav
}: {
  item: AttentionItem;
  onReview: () => void;
  selected: boolean;
  selecting: boolean;
  onSelect: (range: boolean) => void;
} & ReturnType<ReturnType<typeof useListNavigation>["rowProps"]>) {
  const reason = reasonOf(item);
  return (
    <div
      {...nav}
      data-selected={selected}
      className={cn(
        "group flex items-center gap-3 border-border-subtle border-b px-4 py-2.5 transition-colors hover:bg-surface-hover data-[selected=true]:bg-accent-soft md:h-11 md:px-5 md:py-0",
        navigableRow,
      )}
    >
      <SelectBox
        label={`Select ${item.skill} in ${item.project.name}`}
        checked={selected}
        selecting={selecting}
        onToggle={onSelect}
      />
      <span
        className={cn(
          "self-start pt-0.5 [&_svg]:size-4 md:self-auto md:pt-0",
          toneText(REASON[reason].tone),
        )}
      >
        {ICONS[reason]}
      </span>
      {/* One line on wide screens; skill and project above the reason on phones. */}
      <div className="min-w-0 flex-1 md:flex md:items-center md:gap-3">
        <div className="flex min-w-0 shrink-0 items-center gap-2 md:gap-3">
          <Link
            to="/library/$skillName"
            params={{ skillName: item.skill }}
            className="truncate font-medium text-fg hover:underline max-md:text-[14px]"
          >
            {item.skill}
          </Link>
          <Link
            to="/projects/$projectId"
            params={{ projectId: item.project.id }}
            className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[12px] text-fg-muted hover:border-border-strong hover:text-fg md:flex"
          >
            <ProjectAvatar name={item.project.name} className="size-3.5 text-[8px]" />
            {item.project.name}
          </Link>
        </div>
        <p className="mt-0.5 text-[12.5px] text-fg-muted max-md:line-clamp-2 md:mt-0 md:flex-1 md:truncate md:text-[13px]">
          <span className="text-fg md:hidden">{item.project.name} · </span>
          {describeAttention(item)}
        </p>
      </div>
      <QuickAction item={item} onReview={onReview} />
      <Tooltip
        label={
          item.kept ? "Kept: never expires" : `Due ${new Date(item.dueAt).toLocaleDateString()}`
        }
      >
        <span className="hidden w-14 shrink-0 text-right text-[12px] text-fg-subtle tabular-nums md:block">
          {item.kept ? "Kept" : shortDate(item.dueAt)}
        </span>
      </Tooltip>
      <LoanMenu
        projectId={item.project.id}
        projectName={item.project.name}
        skill={item.skill}
        content={item.content}
        kept={item.kept}
        loanDays={item.loanDays}
      />
    </div>
  );
}

/** Revealed on hover or selection; always shown on touch screens, which can't hover. */
const revealed =
  "opacity-0 transition-opacity group-hover:opacity-100 group-data-[active=true]:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100";

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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-border-subtle border-b bg-yellow/5 px-4 py-3 text-[13px] md:px-5 md:py-2.5">
      <TriangleAlert className="size-4 shrink-0 text-yellow" />
      <span className="min-w-[12rem] flex-1 text-fg-muted">
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
