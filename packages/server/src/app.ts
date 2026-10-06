import type { Context, SystemOptions } from "@shelf/core";
import { Hono } from "hono";
import { type ChangeFeed, watchChanges } from "./changes.ts";
import { TOKEN_HEADER } from "./contract.ts";
import type { AppEnv } from "./env.ts";
import { errorBody, handleError } from "./errors.ts";
import { activityRoutes, maintenanceRoutes } from "./routes/activity.ts";
import { attentionRoutes } from "./routes/attention.ts";
import { eventRoutes } from "./routes/events.ts";
import { insightsRoutes } from "./routes/insights.ts";
import { projectRoutes } from "./routes/projects.ts";
import { scanRoutes } from "./routes/scan.ts";
import { searchRoutes } from "./routes/search.ts";
import { skillRoutes } from "./routes/skills.ts";
import { systemRoutes } from "./routes/system.ts";

export interface Guard {
  readonly token: string;
  /** Whether a request's host is this server; anything else is a DNS-rebinding attempt. */
  readonly isAllowedHost: (host: string) => boolean;
}

/**
 * The JSON API. Every route is a thin call into @shelf/core, so the dashboard
 * can never behave differently from the CLI.
 */
export function createApi(
  ctx: Context,
  guard: Guard,
  system: SystemOptions,
  changes: ChangeFeed = watchChanges(ctx),
) {
  return new Hono<AppEnv>()
    .basePath("/api")
    .use(async (c, next) => {
      // The request URL's host comes from the Host header, which a DNS-rebinding
      // page cannot set to 127.0.0.1:<port>.
      if (!guard.isAllowedHost(new URL(c.req.url).host)) {
        return c.json(errorBody("FORBIDDEN", "Unexpected Host header"), 403);
      }
      if (c.req.header(TOKEN_HEADER) !== guard.token) {
        return c.json(errorBody("UNAUTHORIZED", "Missing or wrong dashboard token"), 401);
      }
      c.set("ctx", ctx);
      c.set("system", system);
      c.set("changes", changes);
      await next();
    })
    .route("/attention", attentionRoutes)
    .route("/projects", projectRoutes)
    .route("/skills", skillRoutes)
    .route("/search", searchRoutes)
    .route("/activity", activityRoutes)
    .route("/insights", insightsRoutes)
    .route("/system", systemRoutes)
    .route("/events", eventRoutes)
    .route("/", maintenanceRoutes)
    .route("/", scanRoutes)
    .notFound((c) => c.json(errorBody("NOT_FOUND", `No route ${c.req.method} ${c.req.path}`), 404))
    .onError(handleError);
}

/** The API contract. The web app imports this type (never the runtime code). */
export type Api = ReturnType<typeof createApi>;
