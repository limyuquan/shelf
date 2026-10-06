import {
  activity,
  borrow,
  listProjectOverviews,
  projectReport,
  renew,
  returnSkill,
  setDue,
  sync,
  update,
} from "@shelf/core";
import { Hono } from "hono";
import type { AppEnv } from "../env.ts";
import {
  borrowBody,
  defined,
  dueBody,
  forceBody,
  loanParams,
  projectParams,
  renewBody,
} from "../schemas.ts";
import { inProject } from "../scope.ts";
import { validate } from "../validate.ts";

/** Projects and the loans inside them. Writes go through the same services as the CLI. */
export const projectRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await listProjectOverviews(c.get("ctx"))))

  .get("/:id", validate("param", projectParams), async (c) => {
    const { project, ctx } = inProject(c.get("ctx"), c.req.valid("param").id);
    return c.json({
      report: await projectReport(ctx, project),
      events: activity(ctx, { limit: 50, projectId: project.id }),
    });
  })

  .post("/:id/sync", validate("param", projectParams), async (c) => {
    const { ctx } = inProject(c.get("ctx"), c.req.valid("param").id);
    return c.json(await sync(ctx));
  })

  .post("/:id/loans", validate("param", projectParams), validate("json", borrowBody), async (c) => {
    const { ctx } = inProject(c.get("ctx"), c.req.valid("param").id);
    const { skills, days } = c.req.valid("json");
    return c.json(await borrow(ctx, skills, defined({ days })));
  })

  .post(
    "/:id/loans/:skill/renew",
    validate("param", loanParams),
    validate("json", renewBody),
    async (c) => {
      const { id, skill } = c.req.valid("param");
      return c.json(
        await renew(inProject(c.get("ctx"), id).ctx, skill, defined(c.req.valid("json"))),
      );
    },
  )

  .post(
    "/:id/loans/:skill/due",
    validate("param", loanParams),
    validate("json", dueBody),
    async (c) => {
      const { id, skill } = c.req.valid("param");
      const { when, reason } = c.req.valid("json");
      return c.json(
        await setDue(inProject(c.get("ctx"), id).ctx, skill, when, defined({ reason })),
      );
    },
  )

  .post(
    "/:id/loans/:skill/update",
    validate("param", loanParams),
    validate("json", forceBody),
    async (c) => {
      const { id, skill } = c.req.valid("param");
      const [result] = await update(
        inProject(c.get("ctx"), id).ctx,
        [skill],
        defined(c.req.valid("json")),
      );
      return c.json(result);
    },
  )

  .post(
    "/:id/loans/:skill/return",
    validate("param", loanParams),
    validate("json", forceBody),
    async (c) => {
      const { id, skill } = c.req.valid("param");
      return c.json(
        await returnSkill(inProject(c.get("ctx"), id).ctx, skill, defined(c.req.valid("json"))),
      );
    },
  );
