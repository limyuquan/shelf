import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext } from "@tanstack/react-router";
import { AppShell } from "../components/layout/app-shell.tsx";
import { NotFound, RouteError } from "../routes/errors.tsx";

export interface RouterContext {
  readonly queryClient: QueryClient;
}

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: AppShell,
  notFoundComponent: NotFound,
  errorComponent: RouteError,
});
