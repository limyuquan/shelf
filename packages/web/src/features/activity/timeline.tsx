import { Link } from "@tanstack/react-router";
import {
  ArrowUpCircle,
  BookPlus,
  CircleDot,
  Clock,
  FolderPlus,
  Link2,
  PenLine,
  Pin,
  Undo2,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import type { ActivityEvent } from "../../api/types.ts";
import { ProjectAvatar } from "../../components/project-avatar.tsx";
import { Tooltip } from "../../components/ui/tooltip.tsx";
import { cn } from "../../lib/cn.ts";
import { timeAgo } from "../../lib/format.ts";
import { dayLabel, describeGroup, type EventGroup, groupEvents } from "./describe.ts";

const ICONS: Partial<Record<ActivityEvent["type"], ReactNode>> = {
  "loan.used": <Zap />,
  "loan.borrowed": <BookPlus />,
  "loan.adopted": <BookPlus />,
  "loan.due-changed": <Clock />,
  "loan.kept": <Pin />,
  "loan.updated": <ArrowUpCircle />,
  "loan.returned": <Undo2 />,
  "loan.expired": <Undo2 />,
  "skill.created": <BookPlus />,
  "skill.revised": <PenLine />,
  "skill.linked": <Link2 />,
  "project.registered": <FolderPlus />,
};

/**
 * The activity log as sentences — "claude-code used convex in nayacalendar" —
 * under day headings. `compact` is for narrow side panels.
 */
export function Timeline({
  events,
  showProject = true,
  compact = false,
}: {
  events: readonly ActivityEvent[];
  showProject?: boolean;
  compact?: boolean;
}) {
  const groups = groupEvents(events);
  const days = new Map<string, EventGroup[]>();
  for (const group of groups) {
    const label = dayLabel(group.at);
    days.set(label, [...(days.get(label) ?? []), group]);
  }
  return (
    <div className={cn("flex flex-col", compact ? "gap-3" : "gap-6")}>
      {[...days].map(([label, entries]) => (
        <section key={label}>
          {!compact && (
            <h3 className="mb-1 pl-1 font-medium text-[12px] text-fg-subtle">{label}</h3>
          )}
          <ol>
            {entries.map((group) => (
              <TimelineEntry
                key={group.key}
                group={group}
                showProject={showProject}
                compact={compact}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function TimelineEntry({
  group,
  showProject,
  compact,
}: {
  group: EventGroup;
  showProject: boolean;
  compact: boolean;
}) {
  const { actor, verb, preposition, detail } = describeGroup(group);
  return (
    <li className={cn("flex gap-3", compact ? "py-1" : "py-1.5 pl-1")}>
      {!compact && (
        <span className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-fg-muted [&_svg]:size-3.5">
          {ICONS[group.type] ?? <CircleDot />}
        </span>
      )}
      <div
        className={cn(
          "min-w-0 flex-1 text-fg-muted",
          compact ? "text-[12.5px] leading-[18px]" : "pt-0.5 text-[13px] leading-5",
        )}
      >
        <span className="font-medium text-fg">{actor}</span> {verb} <Skills names={group.skills} />
        {showProject && group.project && group.projectId && (
          <>
            {preposition && ` ${preposition} `}
            <Link
              to="/projects/$projectId"
              params={{ projectId: group.projectId }}
              className="inline-flex items-center gap-1 align-bottom font-medium text-fg hover:underline"
            >
              <ProjectAvatar name={group.project} className="size-3.5 text-[8px]" />
              {group.project}
            </Link>
          </>
        )}
        {detail && <span className="text-fg-subtle"> · {detail}</span>}
        <Tooltip label={new Date(group.at).toLocaleString()}>
          <span className="ml-1.5 whitespace-nowrap text-[12px] text-fg-subtle">
            {timeAgo(group.at)}
          </span>
        </Tooltip>
      </div>
    </li>
  );
}

function Skills({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  if (names.length <= 2) {
    return (
      <>
        {names.map((name, index) => (
          <span key={name}>
            {index > 0 && " and "}
            <Link
              to="/library/$skillName"
              params={{ skillName: name }}
              className="font-medium text-fg hover:underline"
            >
              {name}
            </Link>
          </span>
        ))}
      </>
    );
  }
  return (
    <Tooltip label={names.join(", ")}>
      <span className="cursor-default font-medium text-fg underline decoration-border-strong decoration-dotted underline-offset-4">
        {names.length} skills
      </span>
    </Tooltip>
  );
}
