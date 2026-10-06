import { searchLibrary } from "@shelf/core";
import { Hono } from "hono";
import type { AppEnv } from "../env.ts";
import { defined, searchQuery } from "../schemas.ts";
import { atHome } from "../scope.ts";
import { validate } from "../validate.ts";

/** Full-text search over the library's skills, best first. */
export const searchRoutes = new Hono<AppEnv>().get(
  "/",
  validate("query", searchQuery),
  async (c) => {
    const { q, limit } = c.req.valid("query");
    return c.json(await searchLibrary(atHome(c.get("ctx")), q ?? "", defined({ limit })));
  },
);
