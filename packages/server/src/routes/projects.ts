import {
  activity,
  borrow,
  diffSkill,
  keep,
  listProjectOverviews,
  projectReport,
  promote,
  propagate,
  renew,
  returnSkill,
  setDue,
  suggestSkills,
  sync,
  update,
} from "@shelf/core";
import { Hono } from "hono";
import type { AppEnv } from "../env.ts";
import {
  borrowBody,
  defined,
  diffQuery,
  dueBody,
  forceBody,
  keepBody,
  loanParams,
  projectParams,
  promoteBody,
  renewBody,
} from "../schemas.ts";
import { atHome, inProject } from "../scope.ts";
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

  /** Library skills matching the project's dependencies and files, best first. */
  .get("/:id/suggestions", validate("param", projectParams), async (c) => {
    const { project, ctx } = inProject(c.get("ctx"), c.req.valid("param").id);
    return c.json(await suggestSkills(ctx, project));
  })

  .post("/:id/sync", validate("param", projectParams), async (c) => {
    const { ctx } = inProject(c.get("ctx"), c.req.valid("param").id);
    return c.json(await sync(ctx));
  })

  .post("/:id/loans", validate("param", projectParams), validate("json", borrowBody), async (c) => {
    const { ctx } = inProject(c.get("ctx"), c.req.valid("param").id);
    const { skills, ...options } = c.req.valid("json");
    return c.json(await borrow(ctx, skills, defined(options)));
  })

  /** Keeps a loan (it never expires) or stops keeping it. */
  .post(
    "/:id/loans/:skill/keep",
    validate("param", loanParams),
    validate("json", keepBody),
    async (c) => {
      const { id, skill } = c.req.valid("param");
      const [result] = await keep(
        inProject(c.get("ctx"), id).ctx,
        [skill],
        defined(c.req.valid("json")) as { keep: boolean; reason?: string },
      );
      return c.json(result);
    },
  )

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
    "/:id/loans/:skill/promote",
    validate("param", loanParams),
    validate("json", promoteBody),
    async (c) => {
      const { id, skill } = c.req.valid("param");
      const { force, propagate: everywhere } = c.req.valid("json");
      const result = await promote(inProject(c.get("ctx"), id).ctx, skill, defined({ force }));
      return c.json({
        ...result,
        propagation: everywhere ? await propagate(atHome(c.get("ctx")), skill) : null,
      });
    },
  )

  /** Defaults to this project's edits, or pending library changes when there are none. */
  .get(
    "/:id/loans/:skill/diff",
    validate("param", loanParams),
    validate("query", diffQuery),
    async (c) => {
      const { id, skill } = c.req.valid("param");
      const { ctx } = inProject(c.get("ctx"), id);
      return c.json(await diffSkill(ctx, skill, defined(c.req.valid("query"))));
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
