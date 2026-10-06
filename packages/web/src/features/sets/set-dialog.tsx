import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import type { SkillSet } from "../../api/types.ts";
import { Button } from "../../components/ui/button.tsx";
import { Checkbox } from "../../components/ui/checkbox.tsx";
import { Dialog, DialogLayout } from "../../components/ui/dialog.tsx";
import { cn } from "../../lib/cn.ts";
import { skillsQuery } from "../skills/queries.ts";
import { useSaveSet } from "./queries.ts";

/** The skill-name rules, which set names share. */
const SET_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const field =
  "h-8 w-full rounded-md border border-border bg-surface px-2.5 text-[13px] text-fg outline-none placeholder:text-fg-subtle focus:border-border-strong disabled:opacity-60 pointer-coarse:h-10 pointer-coarse:text-[16px]";

/**
 * Create a set (`set` omitted) or edit one: its description and skills. The name
 * is fixed once created. Give it a new `key` per opening so the form starts over.
 */
export function SetDialog({
  open,
  onOpenChange,
  set,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  set?: SkillSet;
  /** Names already taken, so creating doesn't silently replace another set. */
  existing: readonly string[];
}) {
  const [name, setName] = useState(set?.name ?? "");
  const [description, setDescription] = useState(set?.description ?? "");
  const [selected, setSelected] = useState<string[]>(set ? [...set.skills] : []);
  const [query, setQuery] = useState("");
  const skills = useQuery(skillsQuery());
  const save = useSaveSet();

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = (skills.data ?? []).filter((skill) =>
    terms.every((term) => `${skill.name} ${skill.description}`.toLowerCase().includes(term)),
  );
  const toggle = (skill: string, on: boolean) =>
    setSelected((current) => (on ? [...current, skill] : current.filter((s) => s !== skill)));

  const taken = !set && existing.includes(name);
  const nameProblem =
    name === ""
      ? null
      : !SET_NAME.test(name) || name.length > 64
        ? "Lowercase letters, digits and single hyphens, e.g. frontend"
        : taken
          ? `A set named ${name} already exists`
          : null;
  const canSave = name !== "" && !nameProblem && selected.length > 0 && !save.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogLayout
        title={set ? `Edit ${set.name}` : "New set"}
        description="A set borrows all of its skills in one step. Each skill still gets its own loan."
        footer={
          <>
            <span className="mr-auto text-[12.5px] text-fg-muted pointer-coarse:text-[14px]">
              {selected.length} skill{selected.length === 1 ? "" : "s"} selected
            </span>
            <Button
              variant="primary"
              disabled={!canSave}
              onClick={() =>
                save.mutate(
                  { name, description, skills: selected },
                  { onSuccess: () => onOpenChange(false) },
                )
              }
            >
              {set ? "Save set" : "Create set"}
            </Button>
          </>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <label className="flex flex-col gap-1.5">
            <span className="font-medium text-[12px] text-fg-muted">Name</span>
            <input
              autoFocus
              disabled={Boolean(set)}
              value={name}
              onChange={(event) =>
                setName(event.target.value.toLowerCase().replace(/[\s_]+/g, "-"))
              }
              placeholder="frontend"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-invalid={Boolean(nameProblem)}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-medium text-[12px] text-fg-muted">Description</span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What the set is for (optional)"
              className={field}
            />
          </label>
          {nameProblem && (
            <p className={cn("text-[12px] sm:col-span-2", taken ? "text-red" : "text-fg-muted")}>
              {nameProblem}
            </p>
          )}
        </div>

        <div className="mb-2 flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-2.5 focus-within:border-border-strong pointer-coarse:h-10">
          <Search className="size-3.5 text-fg-subtle" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter skills"
            aria-label="Filter skills"
            className="flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle pointer-coarse:text-[16px]"
          />
        </div>
        {shown.length === 0 ? (
          <p className="py-8 text-center text-fg-muted">
            {skills.data ? "No matching skills." : "Loading…"}
          </p>
        ) : (
          <ul className="flex flex-col">
            {shown.map((skill) => (
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
                    <span className="line-clamp-1 text-[12.5px] text-fg-muted">
                      {skill.description}
                    </span>
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
