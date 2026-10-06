import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUpDown } from "lucide-react";
import { useState } from "react";
import type { SkillInsight } from "../../api/types.ts";
import { Button } from "../../components/ui/button.tsx";
import { Menu, MenuRadioGroup } from "../../components/ui/menu.tsx";
import { StatusPill } from "../../components/ui/status.tsx";
import { cn } from "../../lib/cn.ts";
import { timeAgo } from "../../lib/format.ts";
import { Sparkline } from "./charts.tsx";
import {
  formatTokens,
  plural,
  SKILL_SORTS,
  type SkillSort,
  sortSkills,
  usageBadge,
} from "./describe.ts";

/** Columns from `md` up; below it each skill is a stacked row. */
const GRID =
  "md:grid md:grid-cols-[minmax(0,1fr)_96px_72px_88px_80px_80px_72px] md:items-center md:gap-4";

const COLUMNS: { sort: SkillSort | null; label: string }[] = [
  { sort: null, label: "Last 30 days" },
  { sort: "active", label: "Active" },
  { sort: "lastUsed", label: "Last used" },
  { sort: "session", label: "Session" },
  { sort: "body", label: "Body" },
  { sort: "borrowers", label: "Projects" },
];

export function SkillsTable({ skills }: { skills: readonly SkillInsight[] }) {
  const [sort, setSort] = useState<SkillSort>("active");
  const sorted = sortSkills(skills, sort);
  const max = Math.max(1, ...skills.flatMap((skill) => skill.daily));

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between md:hidden">
        <span className="text-[12px] text-fg-subtle">{plural(skills.length, "skill")}</span>
        <Menu
          align="end"
          trigger={
            <Button size="sm" variant="ghost">
              <ArrowUpDown />
              {SKILL_SORTS.find((option) => option.value === sort)?.label}
            </Button>
          }
        >
          <MenuRadioGroup value={sort} onChange={setSort} options={SKILL_SORTS} />
        </Menu>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <div
          className={cn(
            "hidden h-9 border-border-subtle border-b bg-surface-raised px-4 text-[12px] text-fg-subtle",
            GRID,
          )}
        >
          <span>Skill</span>
          {COLUMNS.map((column) =>
            column.sort === null ? (
              <span key={column.label}>{column.label}</span>
            ) : (
              <SortHeader
                key={column.label}
                label={column.label}
                active={sort === column.sort}
                onClick={() => setSort(column.sort as SkillSort)}
              />
            ),
          )}
        </div>
        {sorted.map((skill) => (
          <SkillRow key={skill.name} skill={skill} max={max} />
        ))}
      </div>
    </div>
  );
}

function SortHeader({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Sort by ${label.toLowerCase()}`}
      className={cn(
        "flex items-center justify-end gap-1 text-right hover:text-fg",
        active && "font-medium text-fg",
      )}
    >
      {label}
      <ArrowDown className={cn("size-3", !active && "invisible")} />
    </button>
  );
}

function SkillRow({ skill, max }: { skill: SkillInsight; max: number }) {
  const badge = usageBadge(skill);
  const lastUsed = skill.lastUsedAt ? timeAgo(skill.lastUsedAt) : "never";
  return (
    <Link
      to="/library/$skillName"
      params={{ skillName: skill.name }}
      className={cn(
        "flex flex-col gap-1.5 border-border-subtle border-b px-4 py-3 text-[12.5px] transition-colors last:border-b-0 hover:bg-surface-hover md:h-11 md:py-0",
        GRID,
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium text-[13px] text-fg">{skill.name}</span>
        {badge && (
          <StatusPill tone={badge === "never used" ? "neutral" : "yellow"}>{badge}</StatusPill>
        )}
        <span className="ml-auto md:hidden">
          <Sparkline daily={skill.daily} max={max} />
        </span>
      </span>
      <span className="hidden md:block">
        <Sparkline daily={skill.daily} max={max} />
      </span>
      <Cell value={String(skill.activeDays30)} />
      <Cell value={lastUsed} muted />
      <Cell value={`~${formatTokens(skill.descriptionTokens)}`} />
      <Cell value={`~${formatTokens(skill.bodyTokens)}`} muted />
      <Cell value={String(skill.borrowers)} />
      <span className="text-fg-subtle md:hidden">
        {[
          plural(skill.activeDays30, "active day"),
          skill.lastUsedAt && `used ${lastUsed}`,
          `~${formatTokens(skill.descriptionTokens)} tok/session`,
          `~${formatTokens(skill.bodyTokens)} on use`,
          plural(skill.borrowers, "project"),
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </Link>
  );
}

function Cell({ value, muted }: { value: string; muted?: boolean }) {
  return (
    <span
      className={cn("hidden text-right tabular-nums md:block", muted ? "text-fg-muted" : "text-fg")}
    >
      {value}
    </span>
  );
}
