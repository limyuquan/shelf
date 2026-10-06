import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.ts";
import { IconButton } from "./button.tsx";

/**
 * Where a dialog sits on phones: `bottom` sheets suit dialogs with actions (thumb
 * reach); `top` suits search, so the on-screen keyboard doesn't cover the results.
 * From the `sm` breakpoint up, every dialog is a centred card.
 */
type Placement = "bottom" | "top";

const PLACEMENT: Record<Placement, string> = {
  bottom:
    "max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[92dvh] max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom)] max-sm:data-[ending-style]:translate-y-8 max-sm:data-[starting-style]:translate-y-8",
  top: "max-sm:inset-x-0 max-sm:top-0 max-sm:max-h-[80dvh] max-sm:rounded-t-none max-sm:pt-[env(safe-area-inset-top)] max-sm:data-[ending-style]:-translate-y-8 max-sm:data-[starting-style]:-translate-y-8",
};

/** A modal dialog, controlled by `open`. */
export function Dialog({
  open,
  onOpenChange,
  children,
  className,
  label,
  placement = "bottom",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  /** Accessible name when the dialog has no visible title. */
  label?: string;
  placement?: Placement;
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-black/50 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <BaseDialog.Popup
          aria-label={label}
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden bg-surface-overlay shadow-popup outline-none transition-[opacity,transform] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
            "sm:top-[12vh] sm:left-1/2 sm:max-h-[76vh] sm:w-[min(640px,calc(100vw-32px))] sm:-translate-x-1/2 sm:rounded-xl sm:data-[ending-style]:scale-[0.98] sm:data-[starting-style]:scale-[0.98]",
            "max-sm:w-full max-sm:rounded-2xl",
            PLACEMENT[placement],
            className,
          )}
        >
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

/** Title bar, scrolling body and action footer for dialogs with content. */
export function DialogLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-4 border-border border-b px-5 py-4">
        <div className="min-w-0">
          <BaseDialog.Title className="font-semibold text-[14px] text-fg">{title}</BaseDialog.Title>
          {description && (
            <BaseDialog.Description className="mt-1 text-[13px] text-fg-muted">
              {description}
            </BaseDialog.Description>
          )}
        </div>
        <BaseDialog.Close render={<IconButton label="Close" className="-mr-1.5 -mt-1" />}>
          <X />
        </BaseDialog.Close>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-border border-t px-5 py-3">
          {footer}
        </div>
      )}
    </>
  );
}
