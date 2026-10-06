import { adopt, defaultScanRoot, scan } from "@shelf/core";
import { Hono } from "hono";
import type { AppEnv } from "../env.ts";
import { adoptBody, defined, scanQuery } from "../schemas.ts";
import { atHome } from "../scope.ts";
import { validate } from "../validate.ts";

/** Finding hand-copied skills on disk and adopting them into the library. */
export const scanRoutes = new Hono<AppEnv>()
  /** Without `root`, scans the folder that holds the registered projects. */
  .get("/scan", validate("query", scanQuery), async (c) => {
    const ctx = atHome(c.get("ctx"));
    const { root, depth } = c.req.valid("query");
    const dir = root?.replace(/^~(?=\/|$)/, ctx.paths.userHome) ?? (await defaultScanRoot(ctx));
    const report = await scan(ctx, dir, { maxDepth: depth ?? 6 });
    // The home directory lets the dashboard show paths as `~/…`.
    return c.json({ root: report.root, home: ctx.paths.userHome, report });
  })

  .post("/adopt", validate("json", adoptBody), async (c) => {
    const { paths, unedited } = c.req.valid("json");
    return c.json(await adopt(atHome(c.get("ctx")), paths, defined({ unedited })));
  });
