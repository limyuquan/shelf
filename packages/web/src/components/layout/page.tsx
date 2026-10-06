import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Menu, Search } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { cn } from "../../lib/cn.ts";
import { IconButton } from "../ui/button.tsx";
import { useShell } from "./shell-context.ts";

export interface Crumb {
  readonly label: string;
  /** Omitted for the current page. */
  readonly to?: string;
}

/**
 * The bar at the top of every page: breadcrumbs on the left, actions on the
 * right. On narrow screens it adds the navigation button and shows only the
 * current page, with a back link to its parent.
 */
export function PageHeader({ crumbs, actions }: { crumbs: Crumb[]; actions?: ReactNode }) {
  const { openNavigation, openSearch } = useShell();
  const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2] : undefined;
  return (
    <header className="box-content flex h-12 shrink-0 items-center justify-between gap-3 border-border-subtle border-b pt-[env(safe-area-inset-top)] pr-[max(env(safe-area-inset-right),12px)] pl-[max(env(safe-area-inset-left),8px)] md:pr-5 md:pl-5 lg:pt-0">
      <div className="flex min-w-0 items-center gap-1">
        <IconButton label="Open navigation" onClick={openNavigation} className="lg:hidden">
          <Menu />
        </IconButton>
        {parent?.to && (
          <Link
            to={parent.to}
            aria-label={`Back to ${parent.label}`}
            className="flex size-10 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface-hover md:hidden"
          >
            <ChevronLeft className="size-[18px]" />
          </Link>
        )}
        <nav className="flex min-w-0 items-center gap-1.5 text-[13px]" aria-label="Breadcrumb">
          {crumbs.map((crumb, index) => {
            const current = index === crumbs.length - 1;
            return (
              <Fragment key={crumb.label}>
                {index > 0 && (
                  <ChevronRight className="size-3.5 shrink-0 text-fg-subtle max-md:hidden" />
                )}
                {crumb.to && !current ? (
                  <Link
                    to={crumb.to}
                    className="truncate text-fg-muted hover:text-fg max-md:hidden"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="truncate font-medium text-fg max-md:text-[15px]">
                    {crumb.label}
                  </span>
                )}
              </Fragment>
            );
          })}
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {actions}
        <IconButton label="Search" onClick={openSearch} className="lg:hidden">
          <Search />
        </IconButton>
      </div>
    </header>
  );
}

/** The scrolling area under the header. */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]", className)}
    >
      {children}
    </div>
  );
}

/**
 * A detail page: the main content plus a properties panel. Side by side from the
 * `xl` breakpoint; below it the panel follows the content in one scrolling column.
 */
export function SplitView({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)] xl:flex xl:overflow-hidden xl:pb-0">
      <div className="relative xl:min-w-0 xl:flex-1 xl:overflow-y-auto">{main}</div>
      {aside}
    </div>
  );
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
      <h2 className="sticky top-0 z-10 flex h-9 items-center gap-2 whitespace-nowrap border-border-subtle border-b bg-surface-raised/80 px-4 font-medium text-[12.5px] text-fg backdrop-blur md:px-5">
        {icon}
        {title}
        {count !== undefined && <span className="text-fg-subtle">{count}</span>}
      </h2>
      {children}
    </section>
  );
}
