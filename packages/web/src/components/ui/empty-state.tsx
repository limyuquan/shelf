import type { ReactNode } from "react";

/** A centred placeholder for lists with nothing in them. */
export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-border bg-surface-raised text-fg-muted [&_svg]:size-5">
        {icon}
      </div>
      <h2 className="font-medium text-[14px] text-fg">{title}</h2>
      {children && <div className="mt-1.5 max-w-sm text-[13px] text-fg-muted">{children}</div>}
    </div>
  );
}
