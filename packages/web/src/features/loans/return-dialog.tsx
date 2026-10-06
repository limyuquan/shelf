import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Checkbox } from "../../components/ui/checkbox.tsx";
import { Dialog, DialogLayout } from "../../components/ui/dialog.tsx";
import { type BulkLoan, isEdited, returnable } from "./bulk.ts";

const skills = (count: number) => `${count} skill${count === 1 ? "" : "s"}`;

/**
 * Confirms returning the selected loans. Loans with local edits are listed on
 * their own and returned only when the user also agrees to delete the edits.
 */
export function ReturnDialog<T extends BulkLoan>({
  loans,
  where,
  label,
  pending,
  onOpenChange,
  onConfirm,
}: {
  loans: readonly T[];
  where: string | undefined;
  label: (loan: T) => string;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (deleteEdits: boolean) => void;
}) {
  const [deleteEdits, setDeleteEdits] = useState(false);
  const clean = loans.filter((loan) => !isEdited(loan));
  const edited = loans.filter(isEdited);
  const count = returnable(loans, deleteEdits).length;

  return (
    <Dialog open onOpenChange={onOpenChange} className="sm:w-[min(480px,calc(100vw-32px))]">
      <DialogLayout
        title={`Return ${skills(loans.length)}?`}
        description={`Their copies are removed from ${where ?? "their projects"}. You can borrow them again any time.`}
        footer={
          <>
            <Button size="md" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="md"
              variant="primary"
              disabled={count === 0 || pending}
              onClick={() => onConfirm(deleteEdits)}
            >
              {pending && <LoaderCircle className="animate-spin" />}
              {count === 0 ? "Return" : `Return ${skills(count)}`}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {clean.length > 0 && <SkillList loans={clean} label={label} />}
          {edited.length > 0 && (
            <section>
              <h3 className="font-medium text-[13px] text-fg">With local edits</h3>
              <p className="mt-0.5 mb-2 text-[12.5px] text-fg-muted">
                Returning deletes these edits. To keep them, promote them to the library first.
              </p>
              <SkillList loans={edited} label={label} muted={!deleteEdits} />
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] text-fg pointer-coarse:text-[15px]">
                <Checkbox
                  label="Also delete local edits"
                  checked={deleteEdits}
                  onChange={setDeleteEdits}
                />
                Also delete local edits
              </label>
            </section>
          )}
        </div>
      </DialogLayout>
    </Dialog>
  );
}

function SkillList<T extends BulkLoan>({
  loans,
  label,
  muted = false,
}: {
  loans: readonly T[];
  label: (loan: T) => string;
  muted?: boolean;
}) {
  return (
    <ul className="flex flex-col rounded-md border border-border-subtle">
      {loans.map((loan) => (
        <li
          key={label(loan)}
          className="flex items-center justify-between gap-3 border-border-subtle border-b px-3 py-1.5 last:border-b-0"
        >
          <span
            className={muted ? "min-w-0 break-all text-fg-subtle" : "min-w-0 break-all text-fg"}
          >
            {label(loan)}
          </span>
          {muted && <span className="shrink-0 text-[12px] text-fg-subtle">not returned</span>}
        </li>
      ))}
    </ul>
  );
}
