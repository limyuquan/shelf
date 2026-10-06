import { useQuery } from "@tanstack/react-query";
import { Layers, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Checkbox } from "../../components/ui/checkbox.tsx";
import { Dialog, DialogLayout } from "../../components/ui/dialog.tsx";
import { projectSuggestionsQuery } from "../projects/queries.ts";
import { setsQuery } from "../sets/queries.ts";
import { skillsQuery } from "../skills/queries.ts";
import { useBorrow } from "./mutations.ts";

/** Pick library skills to borrow into a project. */
export function BorrowDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  borrowed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  /** Skills the project already has, which are not offered. */
  borrowed: readonly string[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [keep, setKeep] = useState(false);
  const skills = useQuery({ ...skillsQuery(), enabled: open });
  const suggestions = useQuery({ ...projectSuggestionsQuery(projectId), enabled: open });
  const sets = useQuery({ ...setsQuery(), enabled: open });
  const borrow = useBorrow();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  // Suggested skills first, best first; the rest keep the catalog's order.
  const rank = new Map((suggestions.data ?? []).map((s, index) => [s.skill, index]));
  const suggestedRank = (name: string) => rank.get(name) ?? rank.size;
  const available = (skills.data ?? [])
    .filter(
      (skill) =>
        !borrowed.includes(skill.name) &&
        terms.every((term) => `${skill.name} ${skill.description}`.toLowerCase().includes(term)),
    )
    .sort((a, b) => suggestedRank(a.name) - suggestedRank(b.name));
  const toggle = (name: string, on: boolean) =>
    setSelected((current) => (on ? [...current, name] : current.filter((n) => n !== name)));
  // A set selects (or, when all are selected, deselects) its members not yet borrowed.
  const offeredSets = (sets.data ?? [])
    .map((set) => ({ ...set, members: set.skills.filter((skill) => !borrowed.includes(skill)) }))
    .filter((set) => set.members.length > 0);
  const toggleSet = (members: readonly string[], on: boolean) =>
    setSelected((current) =>
      on
        ? [...current, ...members.filter((skill) => !current.includes(skill))]
        : current.filter((skill) => !members.includes(skill)),
    );
  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setSelected([]);
      setQuery("");
      setKeep(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogLayout
        title={`Borrow skills into ${projectName}`}
        description="Borrowed skills are copied into the project and renew whenever an agent uses them."
        footer={
          <>
            <label className="mr-auto flex cursor-pointer items-center gap-2 text-[13px] text-fg-muted pointer-coarse:text-[15px]">
              <Checkbox label="Keep (never expires)" checked={keep} onChange={setKeep} />
              Keep (never expires)
            </label>
            <Button
              variant="primary"
              disabled={selected.length === 0 || borrow.isPending}
              onClick={() =>
                borrow.mutate(
                  { projectId, skills: selected, keep },
                  { onSuccess: () => close(false) },
                )
              }
            >
              {selected.length === 0
                ? "Borrow skills"
                : `Borrow ${selected.length} skill${selected.length === 1 ? "" : "s"}`}
            </Button>
          </>
        }
      >
        <div className="-mt-1 mb-3 flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-2.5 focus-within:border-border-strong">
          <Search className="size-3.5 text-fg-subtle" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter skills"
            className="flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
          />
        </div>
        {offeredSets.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 flex items-center gap-1.5 text-[12px] text-fg-subtle">
              <Layers className="size-3.5" />
              Sets
            </span>
            {offeredSets.map((set) => {
              const on = set.members.every((skill) => selected.includes(skill));
              return (
                <button
                  key={set.name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleSet(set.members, !on)}
                  className="h-7 rounded-full border border-border px-2.5 text-[12.5px] text-fg-muted transition-colors hover:border-border-strong hover:text-fg aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-fg pointer-coarse:h-9 pointer-coarse:px-3 pointer-coarse:text-[14px]"
                >
                  {set.name}
                  <span className="ml-1.5 text-fg-subtle tabular-nums">{set.members.length}</span>
                </button>
              );
            })}
          </div>
        )}
        {available.length === 0 ? (
          <p className="py-8 text-center text-fg-muted">
            {skills.data ? "No more skills to borrow." : "Loading…"}
          </p>
        ) : (
          <ul className="flex flex-col">
            {available.map((skill) => (
              <li key={skill.name}>
                <label className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-surface-hover">
                  <span className="pt-0.5">
                    <Checkbox
                      label={skill.name}
                      checked={selected.includes(skill.name)}
                      onChange={(on) => toggle(skill.name, on)}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium text-fg">
                      {skill.name}
                      {rank.has(skill.name) && (
                        <span className="rounded-full bg-accent-soft px-1.5 font-normal text-[11px] text-accent">
                          Suggested
                        </span>
                      )}
                    </span>
                    <span className="line-clamp-2 text-[12.5px] text-fg-muted">
                      {skill.description}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] text-fg-subtle tabular-nums">
                    ~{skill.tokens.toLocaleString()} tok
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </DialogLayout>
    </Dialog>
  );
}
