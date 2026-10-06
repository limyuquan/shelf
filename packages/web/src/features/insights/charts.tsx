import { type KeyboardEvent, useState } from "react";
import type { SkillInsight } from "../../api/types.ts";
import { cn } from "../../lib/cn.ts";
import { dayLabel, niceCeil, plural, scale, skillsUsedOn } from "./describe.ts";

/*
 * Plain SVG/CSS charts on the theme tokens. One emphasis colour (accent) for
 * the data that matters, the muted foreground for context, hairline baselines.
 */

/** 30 days of use as tiny columns; `max` is shared so rows compare. */
export function Sparkline({ daily, max }: { daily: readonly number[]; max: number }) {
  const step = 3;
  const height = 18;
  const width = daily.length * step - 1;
  const days = daily.filter((count) => count > 0).length;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`Used on ${plural(days, "day")} of the last ${daily.length}`}
      className="shrink-0 overflow-visible"
    >
      <rect x={0} y={height - 1} width={width} height={1} fill="var(--border)" />
      {daily.map((count, index) =>
        count > 0 ? (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: one column per day, in order
            key={index}
            x={index * step}
            y={height - Math.max(3, (scale(count, max) / 100) * height)}
            width={step - 1}
            height={Math.max(3, (scale(count, max) / 100) * height)}
            rx={0.5}
            fill="var(--accent)"
          />
        ) : null,
      )}
    </svg>
  );
}

/** A swatch and label for a legend; the mark carries the colour, never the text. */
export function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-fg-muted">
      <span className={cn("inline-block size-2.5 rounded-[3px]", className)} />
      {label}
    </span>
  );
}

/**
 * One project's session cost as a horizontal stacked bar: the global skills at the
 * baseline, the project's own skills after a 2px gap, scaled to the largest total.
 */
export function BudgetBar({
  global,
  borrowed,
  max,
}: {
  global: number;
  borrowed: number;
  max: number;
}) {
  const total = global + borrowed;
  return (
    <div className="flex h-3 w-full items-center" aria-hidden="true">
      <div className="flex h-full gap-[2px]" style={{ width: `${scale(total, max)}%` }}>
        {global > 0 && (
          <div
            className={cn("h-full bg-fg-subtle", borrowed === 0 && "rounded-r-[4px]")}
            style={{ width: `${scale(global, total)}%` }}
          />
        )}
        {borrowed > 0 && (
          <div
            className="h-full rounded-r-[4px] bg-accent"
            style={{ width: `${scale(borrowed, total)}%` }}
          />
        )}
      </div>
      {total === 0 && <div className="h-px w-full bg-border" />}
    </div>
  );
}

/**
 * Distinct skills used per day. Choosing a column (pointer, tap or arrow keys)
 * shows its date, count and skills in the readout above, so nothing needs hover.
 */
export function ActivityChart({
  days,
  active,
  skills,
}: {
  days: readonly string[];
  active: readonly number[];
  skills: readonly SkillInsight[];
}) {
  const last = days.length - 1;
  const [selected, setSelected] = useState(last);
  const top = niceCeil(Math.max(...active, 1));
  const used = skillsUsedOn(skills, selected);
  const day = days[selected] ?? "";

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = { ArrowLeft: selected - 1, ArrowRight: selected + 1, Home: 0, End: last }[
      event.key
    ];
    if (next === undefined) return;
    event.preventDefault();
    const index = Math.min(last, Math.max(0, next));
    setSelected(index);
    event.currentTarget.querySelectorAll("button")[index]?.focus();
  };

  return (
    <div>
      <div
        className="flex min-h-10 flex-wrap items-baseline gap-x-2 text-[12.5px]"
        aria-live="polite"
      >
        <span className="font-medium text-fg tabular-nums">
          {plural(active[selected] ?? 0, "skill")}
        </span>
        <span className="text-fg-muted">{selected === last ? "today" : dayLabel(day)}</span>
        {used.length > 0 && (
          <span className="min-w-0 truncate text-fg-subtle max-md:basis-full">
            {used.join(", ")}
          </span>
        )}
      </div>
      <div className="relative mt-2 h-28">
        <span className="absolute top-0 left-0 -translate-y-1/2 bg-surface pr-1.5 text-[11px] text-fg-subtle tabular-nums">
          {top}
        </span>
        <div className="absolute inset-x-0 top-0 h-px bg-border-subtle" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-border" />
        {/* biome-ignore lint/a11y/useSemanticElements: a group of chart columns, not a fieldset */}
        <div
          role="group"
          aria-label={`Skills active per day, last ${days.length} days`}
          onKeyDown={move}
          className="absolute inset-0 flex items-stretch gap-[2px] pl-6"
        >
          {days.map((date, index) => {
            const count = active[index] ?? 0;
            const isSelected = index === selected;
            return (
              <button
                key={date}
                type="button"
                tabIndex={isSelected ? 0 : -1}
                aria-pressed={isSelected}
                aria-label={`${dayLabel(date)}: ${plural(count, "skill")}`}
                onClick={() => setSelected(index)}
                onPointerEnter={(event) => event.pointerType === "mouse" && setSelected(index)}
                onFocus={() => setSelected(index)}
                className={cn(
                  "group flex h-full min-w-0 flex-1 items-end justify-center rounded-t-[3px] outline-offset-0",
                  isSelected && "bg-surface-hover",
                )}
              >
                {count > 0 && (
                  <span
                    className={cn(
                      "block w-full max-w-4 rounded-t-[4px] bg-accent transition-opacity",
                      !isSelected && "opacity-75",
                    )}
                    style={{ height: `max(3px, ${scale(count, top)}%)` }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between pl-6 text-[11px] text-fg-subtle tabular-nums">
        <span>{dayLabel(days[0] ?? "")}</span>
        <span className="max-sm:hidden">{dayLabel(days[Math.floor(last / 2)] ?? "")}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
