import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Checkbox } from "../../components/ui/checkbox.tsx";
import { Dialog, DialogLayout } from "../../components/ui/dialog.tsx";
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
  const borrow = useBorrow();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const available = (skills.data ?? []).filter(
    (skill) =>
      !borrowed.includes(skill.name) &&
      terms.every((term) => `${skill.name} ${skill.description}`.toLowerCase().includes(term)),
  );
  const toggle = (name: string, on: boolean) =>
    setSelected((current) => (on ? [...current, name] : current.filter((n) => n !== name)));
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
                    <span className="block font-medium text-fg">{skill.name}</span>
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
