import { LoaderCircle } from "lucide-react";
import { Button } from "../../components/ui/button.tsx";
import { Checkbox } from "../../components/ui/checkbox.tsx";
import { plural } from "./select.ts";

/**
 * Pinned under the results while copies are selected. On phones it spans the
 * width and clears the home indicator.
 */
export function AdoptBar({
  count,
  unedited,
  onUneditedChange,
  onAdopt,
  onClear,
  pending,
}: {
  count: number;
  unedited: boolean;
  onUneditedChange: (unedited: boolean) => void;
  onAdopt: () => void;
  onClear: () => void;
  pending: boolean;
}) {
  return (
    <div className="shrink-0 border-border border-t bg-surface-raised px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] shadow-popup md:px-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
          <span className="pt-0.5">
            <Checkbox
              label="These copies have no local edits (older versions)"
              checked={unedited}
              onChange={onUneditedChange}
            />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] text-fg">
              These copies have no local edits (older versions)
            </span>
            <span className="block text-[12px] text-fg-muted">
              Copies that differ from the library become behind, so a plain update catches them up,
              instead of edited. The library's or most common version is adopted first.
            </span>
          </span>
        </label>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" size="md" onClick={onClear} disabled={pending}>
            Clear
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={onAdopt}
            disabled={pending}
            className="max-md:flex-1"
          >
            {pending && <LoaderCircle className="animate-spin" />}
            Adopt {plural(count, "copy", "copies")}
          </Button>
        </div>
      </div>
    </div>
  );
}
