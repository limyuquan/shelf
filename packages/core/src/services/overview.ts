import { dueState } from "../domain/loan-state.ts";
import { pathExists } from "../library/fs.ts";
import { listActiveLoans } from "../store/loans.ts";
import { listProjects } from "../store/projects.ts";
import type { Context } from "./context.ts";

export interface ProjectOverview {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  /** False when the directory no longer exists (moved without being reopened, or deleted). */
  readonly exists: boolean;
  readonly lastSeenAt: Date;
  readonly loans: number;
  readonly dueSoon: number;
  readonly overdue: number;
}

/** Every registered project with loan counts, from the database alone (no hashing). */
export async function listProjectOverviews(ctx: Context): Promise<ProjectOverview[]> {
  const now = ctx.clock.now();
  return Promise.all(
    listProjects(ctx.db).map(async (project) => {
      const states = listActiveLoans(ctx.db, project.id).map((loan) =>
        loan.keep ? "active" : dueState(loan.dueAt, now, ctx.config.dueSoonDays),
      );
      return {
        id: project.id,
        name: project.name,
        path: project.path,
        exists: await pathExists(project.path),
        lastSeenAt: project.lastSeenAt,
        loans: states.length,
        dueSoon: states.filter((state) => state === "due-soon").length,
        overdue: states.filter((state) => state === "overdue").length,
      };
    }),
  );
}
