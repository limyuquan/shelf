import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ReactElement, ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

/** A dropdown menu opened by `trigger` (a button element). */
export function Menu({
  trigger,
  children,
  align = "start",
  side = "bottom",
}: {
  trigger: ReactElement;
  children: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
}) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner side={side} align={align} sideOffset={4} className="z-50">
          <BaseMenu.Popup className="min-w-44 rounded-lg bg-surface-overlay p-1 shadow-popup outline-none transition-[opacity,transform] data-[ending-style]:scale-95 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
            {children}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

export function MenuItem({
  icon,
  children,
  onClick,
  danger,
  shortcut,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  shortcut?: string;
}) {
  return (
    <BaseMenu.Item
      {...(onClick ? { onClick } : {})}
      className={cn(
        "flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-[13px] outline-none data-[highlighted]:bg-surface-hover [&_svg]:size-3.5 pointer-coarse:h-11 pointer-coarse:text-[15px]",
        danger ? "text-red" : "text-fg",
      )}
    >
      {icon && <span className="text-fg-muted">{icon}</span>}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-[11px] text-fg-subtle">{shortcut}</span>}
    </BaseMenu.Item>
  );
}

export function MenuRadioGroup<T extends string>({
  value,
  onChange,
  options,
  closeOnClick = false,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  /** Close after a choice, like a select (by default the menu stays open). */
  closeOnClick?: boolean;
}) {
  return (
    <BaseMenu.RadioGroup value={value} onValueChange={(next) => onChange(next as T)}>
      {options.map((option) => (
        <BaseMenu.RadioItem
          key={option.value}
          value={option.value}
          closeOnClick={closeOnClick}
          className="flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-[13px] text-fg outline-none data-[highlighted]:bg-surface-hover [&_svg]:size-3.5 pointer-coarse:h-11 pointer-coarse:text-[15px]"
        >
          {option.icon && <span className="text-fg-muted">{option.icon}</span>}
          <span className="flex-1">{option.label}</span>
          <BaseMenu.RadioItemIndicator className="size-1.5 rounded-full bg-accent" />
        </BaseMenu.RadioItem>
      ))}
    </BaseMenu.RadioGroup>
  );
}

export const MenuSeparator = () => <BaseMenu.Separator className="my-1 h-px bg-border" />;
