import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import type { GlobalSkill, ProjectInsight } from "../../api/types.ts";
import { ProjectAvatar } from "../../components/project-avatar.tsx";
import { cn } from "../../lib/cn.ts";
import { timeAgo } from "../../lib/format.ts";
import { BudgetBar, LegendItem } from "./charts.tsx";
import { budgetRows, formatTokens, plural } from "./describe.ts";

/** Per project: what every session starts with, global skills plus borrowed descriptions. */
export function ContextBudget({
  projects,
  globalSkills,
}: {
  projects: readonly ProjectInsight[];
  globalSkills: readonly GlobalSkill[];
}) {
  const rows = budgetRows(projects);
  const max = Math.max(...rows.map((row) => row.total), 1);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap gap-x-4 gap-y-1">
        <LegendItem className="bg-fg-subtle" label="Loaded everywhere" />
        <LegendItem className="bg-accent" label="Borrowed by the project" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        {rows.map(({ project, global, borrowed, total }) => {
          const expanded = open === project.id;
          return (
            <div key={project.id} className="border-border-subtle border-b last:border-b-0">
              <button
                type="button"
                aria-expanded={expanded}
                aria-label={`${project.name}: about ${total} tokens at session start, ${global} global and ${borrowed} from ${plural(project.skills.length, "borrowed skill")}`}
                onClick={() => setOpen(expanded ? null : project.id)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 text-left transition-colors hover:bg-surface-hover md:grid-cols-[200px_minmax(0,1fr)_88px] md:py-2.5 pointer-coarse:py-3.5"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <ChevronRight
                    className={cn(
                      "size-3.5 shrink-0 text-fg-subtle transition-transform",
                      expanded && "rotate-90",
                    )}
                  />
                  <ProjectAvatar name={project.name} />
                  <span className="truncate font-medium text-fg">{project.name}</span>
                </span>
                <span className="order-last col-span-2 md:order-none md:col-span-1">
                  <BudgetBar global={global} borrowed={borrowed} max={max} />
                </span>
                <span className="text-right text-[12.5px] text-fg tabular-nums">
                  ~{formatTokens(total)}
                  <span className="text-fg-subtle"> tok</span>
                </span>
              </button>
              {expanded && <ProjectSkills project={project} globalSkills={globalSkills} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProjectSkills({
  project,
  globalSkills,
}: {
  project: ProjectInsight;
  globalSkills: readonly GlobalSkill[];
}) {
  const skills = [...project.skills].sort(
    (a, b) => b.descriptionTokens - a.descriptionTokens || a.skill.localeCompare(b.skill),
  );
  return (
    <div className="border-border-subtle border-t bg-surface-raised px-4 py-2 text-[12.5px] md:pl-10">
      <Line
        swatch="bg-fg-subtle"
        name={`Loaded everywhere · ${plural(globalSkills.length, "skill")}`}
        tokens={project.globalTokens}
        detail="every project"
      />
      {skills.length === 0 ? (
        <p className="py-1.5 text-fg-muted">No borrowed skills.</p>
      ) : (
        skills.map((skill) => (
          <Line
            key={skill.skill}
            swatch="bg-accent"
            name={skill.skill}
            to={skill.skill}
            tokens={skill.descriptionTokens}
            detail={`~${formatTokens(skill.bodyTokens)} on use · ${
              skill.activeDays30 > 0
                ? `${plural(skill.activeDays30, "active day")}`
                : skill.lastUsedAt
                  ? `used ${timeAgo(skill.lastUsedAt)}`
                  : "never used"
            }`}
          />
        ))
      )}
      <Link
        to="/projects/$projectId"
        params={{ projectId: project.id }}
        className="mt-1 inline-flex h-8 items-center text-accent hover:underline pointer-coarse:h-10"
      >
        Open {project.name}
      </Link>
    </div>
  );
}

function Line({
  swatch,
  name,
  to,
  tokens,
  detail,
}: {
  swatch: string;
  name: string;
  to?: string;
  tokens: number;
  detail: string;
}) {
  return (
    <div className="flex min-h-8 flex-wrap items-center gap-x-3 py-1 pointer-coarse:min-h-10">
      <span className={cn("size-2 shrink-0 rounded-[2px]", swatch)} />
      {to ? (
        <Link
          to="/library/$skillName"
          params={{ skillName: to }}
          className="min-w-0 flex-1 truncate text-fg hover:underline"
        >
          {name}
        </Link>
      ) : (
        <span className="min-w-0 flex-1 truncate text-fg">{name}</span>
      )}
      <span className="text-fg-subtle max-md:order-last max-md:basis-full max-md:pl-5">
        {detail}
      </span>
      <span className="w-16 text-right text-fg tabular-nums">~{formatTokens(tokens)}</span>
    </div>
  );
}
