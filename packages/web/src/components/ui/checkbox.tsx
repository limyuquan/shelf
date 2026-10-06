import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Check } from "lucide-react";

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <BaseCheckbox.Root
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      {...(disabled ? { disabled } : {})}
      className="flex size-4 shrink-0 items-center justify-center rounded border border-border-strong bg-surface-raised transition-colors data-[checked]:border-accent data-[checked]:bg-accent data-[disabled]:opacity-40"
    >
      <BaseCheckbox.Indicator className="text-accent-fg">
        <Check className="size-3" strokeWidth={3} />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
}
