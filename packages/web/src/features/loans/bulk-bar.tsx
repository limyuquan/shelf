import { ArrowUpCircle, LoaderCircle, Pin, PinOff, RotateCcw, Undo2, X } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button.tsx";
import { Checkbox } from "../../components/ui/checkbox.tsx";
import { Tooltip } from "../../components/ui/tooltip.tsx";
import { cn } from "../../lib/cn.ts";
import {
  type BulkKind,
  type BulkLoan,
  keepable,
  keepKind,
  renewable,
  returnable,
  updatable,
} from "./bulk.ts";
import { type BulkTarget, useBulkLoanAction } from "./mutations.ts";
import { ReturnDialog } from "./return-dialog.tsx";
import type { Selection } from "./use-selection.ts";

/**
 * A row's selection checkbox. On desktop it shows on hover, on the keyboard's
 * active row, or once anything is selected; touch screens always show it. Its
 * hit area is the whole cell, and shift-click selects a range.
 */
export function SelectBox({
  label,
  checked,
  selecting,
  onToggle,
}: {
  label: string;
  checked: boolean;
  /** Something is selected, so every row's checkbox shows. */
  selecting: boolean;
  onToggle: (range: boolean) => void;
}) {
  // Base UI's change event doesn't carry modifier keys; the press that caused it does.
  const shift = useRef(false);
  return (
    <label
      data-visible={checked || selecting}
      onPointerDownCapture={(event) => {
        shift.current = event.shiftKey;
      }}
      className="-mx-1.5 -my-2.5 flex shrink-0 cursor-pointer select-none items-center justify-center self-stretch px-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-data-[active=true]:opacity-100 data-[visible=true]:opacity-100 md:my-0 pointer-coarse:-ml-2.5 pointer-coarse:mr-0 pointer-coarse:w-10 pointer-coarse:px-0 pointer-coarse:opacity-100"
    >
      <Checkbox
        label={label}
        checked={checked}
        onChange={() => {
          onToggle(shift.current);
          shift.current = false;
        }}
      />
    </label>
  );
}

/**
 * The select-all checkbox for a section header. `className` sets its right
 * margin, so the header's title lines up with the rows' content.
 */
export function SelectAllBox<T>({
  label,
  selection,
  items,
  className,
}: {
  label: string;
  selection: Selection<T>;
  items: readonly T[];
  className?: string;
}) {
  const state = selection.state(items);
  return (
    <label
      className={cn(
        "-ml-1.5 flex shrink-0 cursor-pointer items-center self-stretch px-1.5 pointer-coarse:-ml-2.5 pointer-coarse:w-10 pointer-coarse:justify-center pointer-coarse:px-0",
        className,
      )}
    >
      <Checkbox
        label={label}
        checked={state === "all"}
        indeterminate={state === "some"}
        onChange={() => selection.toggleAll(items)}
      />
    </label>
  );
}

/**
 * The bar pinned under a list while loans are selected, with the selected rows'
 * return dialog. Each action applies to the selected loans it makes sense for
 * (renew skips kept loans, update takes only loans behind the library).
 */
export function BulkBar<T extends BulkLoan>({
  selection,
  target,
  where,
}: {
  selection: Selection<T>;
  target: (item: T) => Omit<BulkTarget, "force">;
  /** Where returned copies are removed from, for the confirmation: a project's name. */
  where?: string;
}) {
  const bulk = useBulkLoanAction();
  const [returning, setReturning] = useState<readonly T[] | null>(null);
  const selected = selection.items;
  const pending = bulk.isPending ? bulk.variables.kind : null;

  const run = (kind: BulkKind, loans: readonly T[], force = false, then?: () => void) =>
    bulk.mutate(
      {
        kind,
        targets: loans.map((loan) => ({ ...target(loan), ...(force ? { force } : {}) })),
      },
      {
        // What failed stays selected, ready to retry or deal with one by one.
        onSuccess: (outcomes) => {
          selection.retain(outcomes.filter((o) => o.error !== null).map((o) => o.key));
          then?.();
        },
      },
    );

  if (selected.length === 0 && !returning) return null;
  const renew = renewable(selected);
  const update = updatable(selected);
  const keep = keepKind(selected);
  const keeping = keepable(selected, keep);

  return (
    <>
      {selected.length > 0 && (
        <div
          data-bulk-bar
          className="shrink-0 border-border border-t bg-surface-raised px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] shadow-popup md:px-5 md:py-2.5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="mr-auto font-medium text-[13px] text-fg tabular-nums"
              aria-live="polite"
            >
              {selected.length} selected
            </span>
            <Button variant="ghost" onClick={selection.clear} className="md:order-last">
              <X />
              Clear
            </Button>
            <div className="flex gap-2 max-md:grid max-md:basis-full max-md:grid-cols-2">
              <Action
                icon={<RotateCcw />}
                label="Renew"
                count={renew.length}
                total={selected.length}
                pending={pending}
                kind="renew"
                none="Kept skills never come due"
                onClick={() => run("renew", renew)}
              />
              <Action
                icon={<ArrowUpCircle />}
                label="Update"
                count={update.length}
                total={selected.length}
                pending={pending}
                kind="update"
                none="None of these are behind the library"
                onClick={() => run("update", update)}
              />
              <Action
                icon={keep === "keep" ? <Pin /> : <PinOff />}
                label={keep === "keep" ? "Keep" : "Stop keeping"}
                count={keeping.length}
                total={selected.length}
                pending={pending}
                kind={keep}
                onClick={() => run(keep, keeping)}
              />
              <Action
                icon={<Undo2 />}
                label="Return"
                count={selected.length}
                total={selected.length}
                pending={pending}
                kind="return"
                onClick={() => setReturning(selected)}
                className="text-red hover:text-red"
              />
            </div>
          </div>
        </div>
      )}
      {returning && (
        <ReturnDialog
          loans={returning}
          where={where}
          label={(loan) => target(loan).label}
          pending={pending === "return"}
          onOpenChange={(open) => !open && setReturning(null)}
          onConfirm={(deleteEdits) =>
            run("return", returnable(returning, deleteEdits), deleteEdits, () => setReturning(null))
          }
        />
      )}
    </>
  );
}

/**
 * One bulk action. When it applies to only some of the selection, it says how
 * many; when it applies to none, it is disabled and says why.
 */
function Action({
  icon,
  label,
  count,
  total,
  kind,
  pending,
  none,
  onClick,
  className,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  total: number;
  kind: BulkKind;
  pending: BulkKind | null;
  /** Why nothing selected can take this action. */
  none?: string;
  onClick: () => void;
  className?: string;
}) {
  const unavailable = count === 0;
  const button = (
    <Button
      size="md"
      // Unavailable actions stay hoverable and focusable so they can say why (a
      // disabled button gets no pointer events); a tap says it too, for touch.
      onClick={unavailable ? () => none && toast(none) : onClick}
      disabled={pending !== null && !unavailable}
      aria-disabled={unavailable || undefined}
      className={cn(
        "max-md:w-full max-md:px-2",
        unavailable && "cursor-default opacity-45",
        className,
      )}
    >
      {pending === kind ? <LoaderCircle className="animate-spin" /> : icon}
      {label}
      {count > 0 && count < total && <span className="text-fg-subtle tabular-nums">{count}</span>}
    </Button>
  );
  if (!unavailable) return button;
  return (
    <Tooltip label={none ?? ""} side="top">
      {button}
    </Tooltip>
  );
}
