import type { ReactNode } from "react";

/** The right-hand panel of detail pages, like an issue tracker's properties sidebar. */
export function PropertiesPanel({ children }: { children: ReactNode }) {
  return (
    <aside className="w-[300px] shrink-0 overflow-y-auto border-border-subtle border-l px-5 py-5">
      <div className="flex flex-col gap-6">{children}</div>
    </aside>
  );
}

export function PropertyGroup({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex h-6 items-center justify-between">
        <h3 className="font-medium text-[12px] text-fg-subtle">{title}</h3>
        {action}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

export function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center gap-3 text-[13px]">
      <span className="w-24 shrink-0 text-fg-muted">{label}</span>
      <span className="min-w-0 flex-1 truncate text-fg">{children}</span>
    </div>
  );
}
