import type { ReactNode } from "react";

/**
 * The properties sidebar of detail pages, like an issue tracker's. Beside the
 * content from `xl` up; below that it follows the content (see SplitView).
 */
export function PropertiesPanel({ children }: { children: ReactNode }) {
  return (
    <aside className="border-border-subtle border-t px-4 py-6 md:px-10 xl:w-[300px] xl:shrink-0 xl:overflow-y-auto xl:border-t-0 xl:border-l xl:px-5 xl:py-5">
      <div className="grid gap-6 md:grid-cols-2 md:gap-x-10 xl:flex xl:flex-col">{children}</div>
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
    <div className="min-w-0">
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
