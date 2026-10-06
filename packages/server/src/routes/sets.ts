import { deleteSet, listSets, saveSet } from "@shelf/core";
import { Hono } from "hono";
import type { AppEnv } from "../env.ts";
import { defined, saveSetBody, setParams } from "../schemas.ts";
import { atHome } from "../scope.ts";
import { validate } from "../validate.ts";

/** Skill sets: machine-local groups of library skills, borrowed as `@name`. */
export const setRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await listSets(atHome(c.get("ctx")))))

  /** Creates the set or replaces its skills (and description, when given). */
  .put("/:name", validate("param", setParams), validate("json", saveSetBody), async (c) => {
    const { skills, ...rest } = c.req.valid("json");
    return c.json(
      await saveSet(atHome(c.get("ctx")), c.req.valid("param").name, { skills, ...defined(rest) }),
    );
  })

  .delete("/:name", validate("param", setParams), async (c) =>
    c.json(await deleteSet(atHome(c.get("ctx")), c.req.valid("param").name)),
  );
