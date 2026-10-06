import type { GlobalSkill } from "../../api/types.ts";
import { StatusPill } from "../../components/ui/status.tsx";
import { formatTokens } from "./describe.ts";

/** User-level skills (e.g. `~/.claude/skills`): loaded in every session of every project. */
export function GlobalSkills({
  skills,
  invalid,
}: {
  skills: readonly GlobalSkill[];
  invalid: number;
}) {
  if (skills.length === 0) {
    return (
      <p className="rounded-lg border border-border border-dashed px-4 py-6 text-center text-[12.5px] text-fg-muted">
        No user-level skills. Nothing loads in every project.
      </p>
    );
  }
  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-border">
        {skills.map((skill) => (
          <div
            key={skill.name}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-border-subtle border-b px-4 py-2.5 text-[12.5px] last:border-b-0 md:h-11 md:flex-nowrap md:py-0"
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate font-medium text-[13px] text-fg">{skill.name}</span>
              {skill.bundled && <StatusPill tone="accent">shelf</StatusPill>}
            </span>
            <span className="flex min-w-0 flex-wrap gap-1 max-md:order-last max-md:basis-full">
              {skill.harnessDirs.map((dir) => (
                <code
                  key={dir}
                  className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-[11px] text-fg-muted"
                >
                  ~/{dir}
                </code>
              ))}
            </span>
            <span className="w-24 text-right text-fg-subtle tabular-nums max-md:hidden">
              ~{formatTokens(skill.bodyTokens)} on use
            </span>
            <span className="w-20 text-right text-fg tabular-nums">
              ~{formatTokens(skill.descriptionTokens)} tok
            </span>
          </div>
        ))}
      </div>
      {invalid > 0 && (
        <p className="mt-2 text-[12px] text-fg-subtle">
          {invalid} more {invalid === 1 ? "directory has" : "directories have"} an invalid SKILL.md
          and {invalid === 1 ? "is" : "are"} not counted.
        </p>
      )}
    </div>
  );
}
