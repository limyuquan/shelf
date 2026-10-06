import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

export interface Crumb {
  readonly label: string;
  /** Omitted for the current page. */
  readonly to?: string;
}

/** The bar at the top of every page: breadcrumbs on the left, actions on the right. */
export function PageHeader({ crumbs, actions }: { crumbs: Crumb[]; actions?: ReactNode }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-border-subtle border-b px-5">
      <nav className="flex min-w-0 items-center gap-1.5 text-[13px]" aria-label="Breadcrumb">
        {crumbs.map((crumb, index) => (
          <Fragment key={crumb.label}>
            {index > 0 && <ChevronRight className="size-3.5 shrink-0 text-fg-subtle" />}
            {crumb.to ? (
              <Link to={crumb.to} className="truncate text-fg-muted hover:text-fg">
                {crumb.label}
              </Link>
            ) : (
              <span className="truncate font-medium text-fg">{crumb.label}</span>
            )}
          </Fragment>
        ))}
      </nav>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </header>
  );
}

/** The scrolling area under the header. */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto", className)}>{children}</div>;
}

/** A labelled group of rows, e.g. "Due soon · 3". */
export function Section({
  title,
  count,
  children,
  icon,
}: {
  title: string;
  count?: number;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="sticky top-0 z-10 flex h-9 items-center gap-2 border-border-subtle border-b bg-surface-raised/80 px-5 font-medium text-[12.5px] text-fg backdrop-blur">
        {icon}
        {title}
        {count !== undefined && <span className="text-fg-subtle">{count}</span>}
      </h2>
      {children}
    </section>
  );
}
