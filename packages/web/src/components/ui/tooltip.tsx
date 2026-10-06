import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ReactElement } from "react";
import { Kbd } from "./kbd.tsx";

/** Wraps one focusable element (usually a button) with a small label and optional shortcut. */
export function Tooltip({
  label,
  shortcut,
  side = "bottom",
  children,
}: {
  label: string;
  shortcut?: string;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactElement;
}) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={6}>
          <BaseTooltip.Popup className="flex items-center gap-2 rounded-md bg-surface-overlay px-2 py-1 text-[12px] text-fg shadow-popup transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
            {label}
            {shortcut && <Kbd>{shortcut}</Kbd>}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}

export const TooltipProvider = BaseTooltip.Provider;
