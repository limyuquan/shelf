import { isClean } from "../domain/loan-state.ts";
import type { Project } from "../domain/types.ts";
import { pathExists } from "../library/fs.ts";
import { listProjects } from "../store/projects.ts";
import { type Action, suggestActions } from "./actions.ts";
import type { Context } from "./context.ts";
import { inspectLoans, type LoanInspection, type LoanReport } from "./inspect.ts";
import { refreshLibrary } from "./library.ts";
import { closeLoanAndFiles, moveLoanToRevision, restoreMissingCopies } from "./loans.ts";
import { findProjectRoot, openProject, requireProject } from "./project.ts";

export interface ProjectSummary {
  readonly id: string;
  readonly name: string;
  readonly path: string;
}

export type StatusReport =
  | { readonly initialized: false; readonly root: string; readonly actions: Action[] }
  | {
      readonly initialized: true;
      readonly project: ProjectSummary;
      readonly loans: LoanReport[];
      /** Overdue skills returned automatically by this call. */
      readonly expired: string[];
      readonly actions: Action[];
      readonly warnings: string[];
    };

/**
 * The one call an agent makes at session start. Enforces expiry (overdue copies
 * without local edits are returned), then reports every loan and what to do next.
 */
export async function status(ctx: Context): Promise<StatusReport> {
  const opened = await openProject(ctx);
  if (!opened) {
    return {
      initialized: false,
      root: await findProjectRoot(ctx.cwd),
      actions: [{ command: "shelf init", reason: "This project is not using shelf yet" }],
    };
  }
  const { project, warnings } = opened;
  const expired = await expireOverdue(ctx, project, await inspectLoans(ctx, project));
  const loans = (await inspectLoans(ctx, project)).map((inspection) => inspection.report);
  return {
    initialized: true,
    project: summarize(project),
    loans,
    expired,
    actions: suggestActions(loans),
    warnings,
  };
}

export interface SyncReport {
  readonly project: ProjectSummary;
  readonly expired: string[];
  readonly restored: string[];
  readonly updated: string[];
  readonly warnings: string[];
}

/**
 * Reconciles the project with its loans: returns overdue skills, restores missing
 * copies, and updates `follow` loans whose copies carry no local edits.
 */
export async function sync(ctx: Context): Promise<SyncReport> {
  const { project, warnings } = await requireProject(ctx);
  return syncProject(ctx, project, warnings);
}

export interface SweepReport {
  readonly synced: SyncReport[];
  /** Registered projects whose directory no longer exists (see `shelf doctor`). */
  readonly missing: ProjectSummary[];
}

/** `sync` for every registered project — suitable for a daily cron job. */
export async function sweep(ctx: Context): Promise<SweepReport> {
  await refreshLibrary(ctx);
  const synced: SyncReport[] = [];
  const missing: ProjectSummary[] = [];
  for (const project of listProjects(ctx.db)) {
    if (await pathExists(project.path)) synced.push(await syncProject(ctx, project, []));
    else missing.push(summarize(project));
  }
  return { synced, missing };
}

async function syncProject(
  ctx: Context,
  project: Project,
  warnings: string[],
): Promise<SyncReport> {
  const expired = await expireOverdue(ctx, project, await inspectLoans(ctx, project));
  const restored: string[] = [];
  const updated: string[] = [];

  for (const inspection of await inspectLoans(ctx, project)) {
    const { loan, report } = inspection;
    if (report.content === "missing") {
      await restoreMissingCopies(ctx, project, inspection);
      restored.push(report.skill);
    } else if (report.content === "behind" && loan.policy === "follow") {
      await moveLoanToRevision(ctx, project, inspection, report.latestRevision, "loan.updated");
      updated.push(report.skill);
    }
  }
  return { project: summarize(project), expired, restored, updated, warnings };
}

async function expireOverdue(
  ctx: Context,
  project: Project,
  inspections: readonly LoanInspection[],
): Promise<string[]> {
  const expired: string[] = [];
  for (const { loan, report } of inspections) {
    if (report.due !== "overdue" || !isClean(report.content)) continue;
    await closeLoanAndFiles(ctx, project, loan, "loan.expired");
    expired.push(report.skill);
  }
  return expired;
}

function summarize(project: Project): ProjectSummary {
  return { id: project.id, name: project.name, path: project.path };
}
