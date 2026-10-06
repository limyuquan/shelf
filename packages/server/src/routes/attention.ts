import { listAttention } from "@shelf/core";
import { Hono } from "hono";
import type { AppEnv } from "../env.ts";

/** Loans across all projects that need action (read-only). */
export const attentionRoutes = new Hono<AppEnv>().get("/", async (c) =>
  c.json(await listAttention(c.get("ctx"))),
);
