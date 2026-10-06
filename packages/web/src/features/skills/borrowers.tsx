import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { SkillPage } from "../../api/types.ts";
import { PropertyGroup } from "../../components/layout/properties.tsx";
import { ProjectAvatar } from "../../components/project-avatar.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Checkbox } from "../../components/ui/checkbox.tsx";
import { StatusDot, type Tone } from "../../components/ui/status.tsx";
import { BorrowInto } from "./borrow-into.tsx";
import { usePropagate } from "./queries.ts";

type Status = SkillPage["propagation"]["projects"][number]["status"];

/** What an update would do to each borrower (the propagation dry run). */
const STATUS: Record<Status, { label: string; tone: Tone }> = {
  current: { label: "Up to date", tone: "green" },
  updated: { label: "Behind", tone: "blue" },
  "skipped-local-changes": { label: "Edited", tone: "orange" },
  "skipped-missing-project": { label: "Missing", tone: "red" },
};

/** Projects borrowing the skill; behind ones can be updated in one step. */
export function Borrowers({ page }: { page: SkillPage }) {
  const { propagation } = page;
  const behind = propagation.projects.filter((p) => p.status === "updated").map((p) => p.project);
  const [selected, setSelected] = useState<string[]>([]);
  const propagate = usePropagate(page.detail.name);
  const chosen = selected.filter((name) => behind.includes(name));

  return (
    <PropertyGroup
      title={`Borrowed by ${propagation.projects.length}`}
      action={
        <BorrowInto
          skill={page.detail.name}
          borrowers={propagation.projects.map((project) => project.project)}
        />
      }
    >
      {propagation.projects.length === 0 && (
        <p className="text-[13px] text-fg-subtle">No project borrows this skill.</p>
      )}
      {propagation.projects.map((borrower) => {
        const status = STATUS[borrower.status];
        const canUpdate = borrower.status === "updated";
        return (
          <div key={borrower.project} className="flex h-8 items-center gap-2.5 text-[13px]">
            {canUpdate ? (
              <Checkbox
                label={`Update ${borrower.project}`}
                checked={selected.includes(borrower.project)}
                onChange={(checked) =>
                  setSelected((current) =>
                    checked
                      ? [...current, borrower.project]
                      : current.filter((name) => name !== borrower.project),
                  )
                }
              />
            ) : (
              <span className="w-4" />
            )}
            <ProjectAvatar name={borrower.project} />
            <Link
              to="/projects/$projectId"
              // The API resolves a project by id, name or path.
              params={{ projectId: borrower.project }}
              className="min-w-0 flex-1 truncate text-fg hover:underline"
            >
              {borrower.project}
            </Link>
            <span className="flex items-center gap-1.5 text-[12px] text-fg-muted">
              <StatusDot tone={status.tone} className="size-1.5" />
              {status.label}
            </span>
          </div>
        );
      })}
      {behind.length > 0 && (
        <Button
          variant="primary"
          className="mt-2 self-start"
          disabled={chosen.length === 0 || propagate.isPending}
          onClick={() => propagate.mutate(chosen, { onSuccess: () => setSelected([]) })}
        >
          Update {chosen.length || ""} to latest
        </Button>
      )}
    </PropertyGroup>
  );
}
