import { activity, sweep } from "@shelf/core";
import { Hono } from "hono";
import type { AppEnv } from "../env.ts";
import { activityQuery, defined } from "../schemas.ts";
import { atHome } from "../scope.ts";
import { validate } from "../validate.ts";

/** The activity log, filterable by project and skill. */
export const activityRoutes = new Hono<AppEnv>().get("/", validate("query", activityQuery), (c) => {
  const { limit, project, skill } = c.req.valid("query");
  return c.json(activity(c.get("ctx"), defined({ limit, projectId: project, skill })));
});

/** Maintenance across every project. */
export const maintenanceRoutes = new Hono<AppEnv>().post("/sweep", async (c) =>
  c.json(await sweep(atHome(c.get("ctx")))),
);
