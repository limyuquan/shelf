import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { SkillSet } from "../../api/types.ts";
import { Button } from "../../components/ui/button.tsx";
import { setsQuery, useDeleteSet } from "./queries.ts";
import { SetDialog } from "./set-dialog.tsx";

const heading =
  "flex h-9 items-center gap-2 border-border-subtle border-b bg-surface-raised/80 px-4 font-medium text-[12.5px] text-fg md:px-5";

/**
 * The Library page's sets: named groups of skills borrowed together (`@name`),
 * each with its skills and Edit/Delete, then a heading for the skills below.
 */
export function SetsSection() {
  const sets = useQuery(setsQuery());
  const remove = useDeleteSet();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<{ key: number; set: SkillSet | undefined }>({
    key: 0,
    set: undefined,
  });
  const edit = (set: SkillSet | undefined) => {
    setDialog((current) => ({ key: current.key + 1, set }));
    setOpen(true);
  };
  if (!sets.data) return null;

  return (
    <>
      <section aria-label="Sets">
        <h2 className={heading}>
          <Layers className="size-3.5 text-fg-subtle" />
          Sets
          <span className="text-fg-subtle">{sets.data.length}</span>
          <Button variant="ghost" className="-mr-2 ml-auto" onClick={() => edit(undefined)}>
            <Plus />
            New set
          </Button>
        </h2>
        {sets.data.length === 0 ? (
          <p className="border-border-subtle border-b px-4 py-3 text-[12.5px] text-fg-muted md:px-5">
            Group skills you often borrow together, then borrow them all in one step.
          </p>
        ) : (
          <ul>
            {sets.data.map((set) => (
              <SetRow
                key={set.name}
                set={set}
                onEdit={() => edit(set)}
                onDelete={() => remove.mutate(set.name)}
              />
            ))}
          </ul>
        )}
      </section>
      <h2 className={heading}>Skills</h2>
      <SetDialog
        key={dialog.key}
        open={open}
        onOpenChange={setOpen}
        existing={sets.data.map((set) => set.name)}
        {...(dialog.set ? { set: dialog.set } : {})}
      />
    </>
  );
}

function SetRow({
  set,
  onEdit,
  onDelete,
}: {
  set: SkillSet;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 border-border-subtle border-b px-4 py-3 md:flex-nowrap md:items-center md:px-5 md:py-2.5">
      <Layers className="mt-0.5 size-4 shrink-0 text-fg-subtle md:mt-0" />
      <div className="min-w-0 flex-1 md:w-56 md:flex-none">
        <div className="font-medium text-fg">{set.name}</div>
        <p className="truncate text-[12.5px] text-fg-muted">
          {set.description || `${set.skills.length} skill${set.skills.length === 1 ? "" : "s"}`}
        </p>
      </div>
      <div className="order-last flex basis-full flex-wrap gap-1.5 pl-8 md:order-none md:min-w-0 md:flex-1 md:basis-auto md:pl-0">
        {set.skills.length === 0 ? (
          <span className="text-[12px] text-fg-subtle">No skills in the library</span>
        ) : (
          set.skills.map((skill) => (
            <Link
              key={skill}
              to="/library/$skillName"
              params={{ skillName: skill }}
              className="rounded-full border border-border px-2 py-0.5 text-[12px] text-fg-muted transition-colors hover:border-border-strong hover:text-fg pointer-coarse:px-2.5 pointer-coarse:py-1 pointer-coarse:text-[13px]"
            >
              {skill}
            </Link>
          ))
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button variant="ghost" onClick={onEdit} aria-label={`Edit ${set.name}`}>
          <Pencil />
          <span className="max-md:hidden">Edit</span>
        </Button>
        <Button variant="danger" onClick={onDelete} aria-label={`Delete ${set.name}`}>
          <Trash2 />
          <span className="max-md:hidden">Delete</span>
        </Button>
      </div>
    </li>
  );
}
