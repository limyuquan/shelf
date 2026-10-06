import { ChevronRight } from "lucide-react";
import type { ScanGroup as ScanGroupData } from "../../api/types.ts";
import { Checkbox } from "../../components/ui/checkbox.tsx";
import { StatusPill, toneText } from "../../components/ui/status.tsx";
import { cn } from "../../lib/cn.ts";
import { shortHash } from "../../lib/format.ts";
import { PathText } from "./path-text.tsx";
import {
  copyLabel,
  groupSelection,
  managedCount,
  plural,
  unmanagedPaths,
  versionLabel,
} from "./select.ts";

/**
 * One skill name found on disk: how many copies and versions, and, expanded,
 * each version's copies. Only copies shelf doesn't manage yet can be selected.
 */
export function ScanGroup({
  group,
  home,
  expanded,
  onExpandedChange,
  selected,
  onSelect,
}: {
  group: ScanGroupData;
  home: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  selected: ReadonlySet<string>;
  onSelect: (paths: string[], on: boolean) => void;
}) {
  const adoptable = unmanagedPaths(group);
  const selection = groupSelection(group, selected);
  const managed = managedCount(group);
  const drifted = group.variants.length > 1;

  return (
    <div className="border-border-subtle border-b">
      <div className="flex items-center gap-3 px-4 md:px-5">
        <span className="flex w-5 shrink-0 justify-center">
          {adoptable.length > 0 && (
            <Checkbox
              label={`Select every unmanaged copy of ${group.name}`}
              checked={selection === "all"}
              indeterminate={selection === "some"}
              onChange={() => onSelect(adoptable, selection !== "all")}
            />
          )}
        </span>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => onExpandedChange(!expanded)}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left pointer-coarse:min-h-14"
        >
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 text-fg-subtle transition-transform",
              expanded && "rotate-90",
            )}
          />
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
            <span className="min-w-0 break-all font-medium text-fg">{group.name}</span>
            <span className="text-[12.5px] text-fg-muted">
              {plural(group.copies, "copy", "copies")} ·{" "}
              <span className={drifted ? toneText("orange") : undefined}>
                {plural(group.variants.length, "version")}
              </span>
            </span>
            {(group.inLibrary || managed > 0) && (
              <span className="flex gap-1.5 max-md:basis-full md:ml-auto">
                {group.inLibrary && <StatusPill tone="green">in library</StatusPill>}
                {managed > 0 && (
                  <StatusPill tone="neutral">
                    {managed === group.copies ? "managed" : `${managed} managed`}
                  </StatusPill>
                )}
              </span>
            )}
          </span>
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 pr-4 pb-4 pl-12 md:pr-5 md:pl-[52px]">
          {group.variants.map((variant) => {
            const badge = versionLabel(variant);
            return (
              <div key={variant.revision}>
                <div className="flex h-8 flex-wrap items-center gap-2">
                  <span className="font-mono text-[12px] text-fg">
                    {shortHash(variant.revision)}
                  </span>
                  {badge && <StatusPill tone={badge.tone}>{badge.label}</StatusPill>}
                  <span className="text-[12px] text-fg-subtle">
                    {plural(variant.copies.length, "copy", "copies")}
                  </span>
                </div>
                <ul>
                  {variant.copies.map((copy) => {
                    const { project, rest } = copyLabel(copy, home);
                    const path = (
                      <span className="min-w-0 flex-1 break-words font-mono text-[12px] leading-5">
                        <span className="text-fg">
                          <PathText path={project} />
                        </span>
                        <span className="text-fg-subtle">
                          <PathText path={rest} />
                        </span>
                      </span>
                    );
                    return (
                      <li key={copy.path}>
                        {copy.managed ? (
                          <div className="-mx-2 flex min-h-9 items-center gap-3 px-2 py-1.5 pointer-coarse:min-h-11">
                            <span className="w-4 shrink-0 pointer-coarse:w-5" />
                            {path}
                            <StatusPill tone="neutral">managed</StatusPill>
                          </div>
                        ) : (
                          <label className="-mx-2 flex min-h-9 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface-hover pointer-coarse:min-h-11">
                            <Checkbox
                              label={`Select ${copy.path}`}
                              checked={selected.has(copy.path)}
                              onChange={(on) => onSelect([copy.path], on)}
                            />
                            {path}
                          </label>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
