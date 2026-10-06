import { insights } from "@shelf/core";
import { Hono } from "hono";
import type { AppEnv } from "../env.ts";

/** Context budget and skill usage across the library and every project. */
export const insightsRoutes = new Hono<AppEnv>().get("/", async (c) =>
  c.json(await insights(c.get("ctx"))),
);
