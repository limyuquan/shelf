import {
  archiveLibrarySkill,
  createSkill,
  duplicateSkill,
  lintSkill,
  renameSkill,
} from "@shelf/core";
import { Hono } from "hono";
import type { AppEnv } from "../env.ts";
import { createSkillBody, lintBody, skillNameBody, skillParams } from "../schemas.ts";
import { atHome } from "../scope.ts";
import { validate } from "../validate.ts";
import { skillPage } from "./skills.ts";

/** Writing and reshaping the library: create, lint, rename, duplicate, archive. */
export const authoringRoutes = new Hono<AppEnv>()
  /** Creates a skill from the template; returns its page, like `GET /:name`. */
  .post("/", validate("json", createSkillBody), async (c) => {
    const { name, description } = c.req.valid("json");
    await createSkill(atHome(c.get("ctx")), name, description);
    return c.json(await skillPage(c.get("ctx"), name));
  })

  /** Lints a SKILL.md draft without saving it, so the editor can check as you type. */
  .post("/lint", validate("json", lintBody), (c) => {
    const { name, content } = c.req.valid("json");
    return c.json(lintSkill(content, name));
  })

  /** Refused while any project borrows the skill. Returns the page under its new name. */
  .post(
    "/:name/rename",
    validate("param", skillParams),
    validate("json", skillNameBody),
    async (c) => {
      const { to } = c.req.valid("json");
      await renameSkill(atHome(c.get("ctx")), c.req.valid("param").name, to);
      return c.json(await skillPage(c.get("ctx"), to));
    },
  )

  .post(
    "/:name/duplicate",
    validate("param", skillParams),
    validate("json", skillNameBody),
    async (c) => {
      const { to } = c.req.valid("json");
      await duplicateSkill(atHome(c.get("ctx")), c.req.valid("param").name, to);
      return c.json(await skillPage(c.get("ctx"), to));
    },
  )

  /** Moves the skill under `archive/`; refused while any project borrows it. */
  .post("/:name/archive", validate("param", skillParams), async (c) =>
    c.json(
      await archiveLibrarySkill(atHome(c.get("ctx")), c.req.valid("param").name, {
        reason: "archived from the dashboard",
      }),
    ),
  );
