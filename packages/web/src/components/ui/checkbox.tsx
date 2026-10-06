import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Check, Minus } from "lucide-react";

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  indeterminate,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  /** Some, not all, of what this checkbox stands for is selected. */
  indeterminate?: boolean;
}) {
  return (
    <BaseCheckbox.Root
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      {...(disabled ? { disabled } : {})}
      {...(indeterminate ? { indeterminate } : {})}
      className="flex size-4 shrink-0 items-center justify-center rounded border border-border-strong bg-surface-raised transition-colors data-[checked]:border-accent data-[indeterminate]:border-accent data-[checked]:bg-accent data-[indeterminate]:bg-accent data-[disabled]:opacity-40 pointer-coarse:size-5"
    >
      <BaseCheckbox.Indicator className="text-accent-fg">
        {indeterminate ? (
          <Minus className="size-3" strokeWidth={3} />
        ) : (
          <Check className="size-3" strokeWidth={3} />
        )}
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
}
