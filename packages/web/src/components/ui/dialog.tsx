import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.ts";
import { IconButton } from "./button.tsx";

/** A modal dialog, controlled by `open`. */
export function Dialog({
  open,
  onOpenChange,
  children,
  className,
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  /** Accessible name when the dialog has no visible title. */
  label?: string;
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <BaseDialog.Popup
          aria-label={label}
          className={cn(
            "fixed top-[12vh] left-1/2 z-50 flex max-h-[76vh] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 flex-col overflow-hidden rounded-xl bg-surface-overlay shadow-popup outline-none transition-[opacity,transform] data-[ending-style]:scale-[0.98] data-[starting-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
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
        <div className="flex items-center justify-end gap-2 border-border border-t px-5 py-3">
          {footer}
        </div>
      )}
    </>
  );
}
