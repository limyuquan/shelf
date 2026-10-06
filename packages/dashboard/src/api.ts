import {
  activity,
  borrow,
  type Context,
  catalog,
  diffSkill,
  listProjectOverviews,
  projectReport,
  propagate,
  renew,
  requireRegisteredProject,
  returnSkill,
  ShelfError,
  saveSkillContent,
  setDue,
  showSkill,
  skillHistory,
  sweep,
  update,
  withCwd,
} from "@shelf/core";
import type { ActivityData, OverviewData, ProjectPageData, SkillPageData } from "./contract.ts";

/**
 * The dashboard's JSON API. Each handler is a thin call into @shelf/core, so the
 * dashboard can never behave differently from the CLI.
 */
export type ApiHandler = (
  ctx: Context,
  request: { params: Record<string, string>; body: Record<string, unknown>; url: URL },
) => Promise<unknown>;

/** Library-level operations run from the shelf home, so no project is implied. */
const atHome = (ctx: Context) => withCwd(ctx, ctx.paths.home);

const inProject = (ctx: Context, ref: string) => {
  const project = requireRegisteredProject(ctx, ref);
  return { project, ctx: withCwd(ctx, project.path) };
};

const optionalString = (value: unknown) => (typeof value === "string" && value ? value : undefined);

async function skillPage(ctx: Context, name: string): Promise<SkillPageData> {
  const home = atHome(ctx);
  const [detail, history, propagation] = [
    await showSkill(home, name),
    await skillHistory(home, name),
    await propagate(home, name, { dryRun: true }),
  ];
  return { detail, history, propagation };
}

type Route = { [method: string]: ApiHandler };

export const API_ROUTES: Record<string, Route> = {
  "/api/overview": {
    GET: async (ctx): Promise<OverviewData> => ({
      projects: await listProjectOverviews(ctx),
      skills: await catalog(atHome(ctx)),
    }),
  },
  "/api/activity": {
    GET: async (ctx, { url }): Promise<ActivityData> => ({
      events: activity(ctx, { limit: Number(url.searchParams.get("limit") ?? 200) }),
    }),
  },
  "/api/sweep": {
    POST: async (ctx) => sweep(atHome(ctx)),
  },
  "/api/projects/:id": {
    GET: async (ctx, { params }): Promise<ProjectPageData> => {
      const { project, ctx: projectCtx } = inProject(ctx, params.id as string);
      return {
        report: await projectReport(projectCtx, project),
        events: activity(ctx, { limit: 50, projectId: project.id }),
      };
    },
  },
  "/api/projects/:id/borrow": {
    POST: async (ctx, { params, body }) => {
      const skills = Array.isArray(body.skills) ? body.skills.map(String) : [];
      return { skills: await borrow(inProject(ctx, params.id as string).ctx, skills) };
    },
  },
  "/api/projects/:id/loans/:skill/:action": {
    POST: async (ctx, { params, body }) => {
      const projectCtx = inProject(ctx, params.id as string).ctx;
      const skill = params.skill as string;
      const reason = optionalString(body.reason);
      switch (params.action) {
        case "renew":
          return renew(projectCtx, skill, {
            ...(typeof body.days === "number" ? { days: body.days } : {}),
            ...(reason ? { reason } : {}),
          });
        case "due":
          return setDue(projectCtx, skill, String(body.when ?? ""), reason ? { reason } : {});
        case "return":
          return returnSkill(projectCtx, skill, { force: body.force === true });
        case "update":
          return { skills: await update(projectCtx, [skill], { force: body.force === true }) };
        default:
          throw new ShelfError("INVALID_ARGUMENT", `Unknown loan action "${params.action}"`);
      }
    },
  },
  "/api/skills/:name": {
    GET: async (ctx, { params }) => skillPage(ctx, params.name as string),
    PUT: async (ctx, { params, body }) => {
      if (typeof body.content !== "string") {
        throw new ShelfError("INVALID_ARGUMENT", "Body must include the new SKILL.md as `content`");
      }
      await saveSkillContent(atHome(ctx), params.name as string, body.content);
      return skillPage(ctx, params.name as string);
    },
  },
  "/api/skills/:name/propagate": {
    POST: async (ctx, { params, body }) => {
      const projects = Array.isArray(body.projects) ? body.projects.map(String) : undefined;
      return propagate(atHome(ctx), params.name as string, projects ? { projects } : {});
    },
  },
  "/api/skills/:name/diff": {
    GET: async (ctx, { params, url }) => {
      const from = optionalString(url.searchParams.get("from"));
      const to = optionalString(url.searchParams.get("to"));
      return diffSkill(atHome(ctx), params.name as string, {
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
    },
  },
};
