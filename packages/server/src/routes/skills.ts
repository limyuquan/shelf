import {
  type Context,
  catalog,
  diffSkill,
  propagate,
  saveSkillContent,
  showSkill,
  skillHistory,
} from "@shelf/core";
import { Hono } from "hono";
import type { AppEnv } from "../env.ts";
import {
  catalogQuery,
  defined,
  diffQuery,
  propagateBody,
  saveSkillBody,
  skillParams,
} from "../schemas.ts";
import { atHome } from "../scope.ts";
import { validate } from "../validate.ts";

/** Everything the skill page shows: the skill, its history, and who an update would reach. */
async function skillPage(ctx: Context, name: string) {
  const home = atHome(ctx);
  return {
    detail: await showSkill(home, name),
    history: await skillHistory(home, name),
    propagation: await propagate(home, name, { dryRun: true }),
  };
}

/** The library. Library-wide operations act from the shelf home, never a project. */
export const skillRoutes = new Hono<AppEnv>()
  .get("/", validate("query", catalogQuery), async (c) =>
    c.json(await catalog(atHome(c.get("ctx")), c.req.valid("query").q ?? "")),
  )

  .get("/:name", validate("param", skillParams), async (c) =>
    c.json(await skillPage(c.get("ctx"), c.req.valid("param").name)),
  )

  .put("/:name", validate("param", skillParams), validate("json", saveSkillBody), async (c) => {
    const { name } = c.req.valid("param");
    await saveSkillContent(atHome(c.get("ctx")), name, c.req.valid("json").content);
    return c.json(await skillPage(c.get("ctx"), name));
  })

  .post(
    "/:name/propagate",
    validate("param", skillParams),
    validate("json", propagateBody),
    async (c) => {
      const { name } = c.req.valid("param");
      return c.json(await propagate(atHome(c.get("ctx")), name, defined(c.req.valid("json"))));
    },
  )

  .get("/:name/diff", validate("param", skillParams), validate("query", diffQuery), async (c) =>
    c.json(
      await diffSkill(
        atHome(c.get("ctx")),
        c.req.valid("param").name,
        defined(c.req.valid("query")),
      ),
    ),
  );
