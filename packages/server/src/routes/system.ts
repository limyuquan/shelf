import { repairSystem, systemReport } from "@shelf/core";
import { Hono } from "hono";
import type { AppEnv } from "../env.ts";
import { atHome } from "../scope.ts";

/** Paths, config, hook status and health checks, and repairing what can be repaired. */
export const systemRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await systemReport(atHome(c.get("ctx")), c.get("system"))))
  .post("/repair", async (c) => {
    await repairSystem(atHome(c.get("ctx")), c.get("system"));
    return c.json(await systemReport(atHome(c.get("ctx")), c.get("system")));
  });
