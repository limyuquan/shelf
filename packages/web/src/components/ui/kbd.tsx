import { cn } from "../../lib/cn.ts";

/** A keyboard key, e.g. <Kbd>⌘K</Kbd>. */
export function Kbd({ children, className }: { children: string; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border bg-surface-raised px-1 font-sans text-[10.5px] text-fg-subtle",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
