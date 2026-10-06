import { type Context, requireRegisteredProject, withCwd } from "@shelf/core";

/** Library-wide operations run from the shelf home, so no project is implied. */
export function atHome(ctx: Context): Context {
  return withCwd(ctx, ctx.paths.home);
}

/** A registered project (by id, name or path) and a context acting inside it. */
export function inProject(ctx: Context, ref: string) {
  const project = requireRegisteredProject(ctx, ref);
  return { project, ctx: withCwd(ctx, project.path) };
}
