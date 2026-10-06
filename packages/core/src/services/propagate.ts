import { isClean } from "../domain/loan-state.ts";
import type { RevisionHash } from "../domain/types.ts";
import { pathExists } from "../library/fs.ts";
import { listActiveLoansForSkill } from "../store/loans.ts";
import { findProjectById } from "../store/projects.ts";
import type { Context } from "./context.ts";
import { inspectBorrowedSkill } from "./inspect.ts";
import { refreshLibrary, requireSkill } from "./library.ts";
import { moveLoanToRevision } from "./loans.ts";

export type PropagationStatus =
  | "updated"
  | "current"
  | "skipped-local-changes"
  | "skipped-missing-project";

export interface PropagateResult {
  readonly skill: string;
  readonly revision: RevisionHash;
  readonly dryRun: boolean;
  readonly projects: {
    readonly project: string;
    readonly path: string;
    /** With `dryRun`, what would happen. */
    readonly status: PropagationStatus;
  }[];
}

/**
 * Pushes the library's latest revision of a skill to every project that borrows
 * it (or only the named projects). Copies with local edits are never touched.
 */
export async function propagate(
  ctx: Context,
  name: string,
  options: { projects?: readonly string[]; dryRun?: boolean } = {},
): Promise<PropagateResult> {
  await refreshLibrary(ctx);
  const skill = requireSkill(ctx, name);
  const only = options.projects?.length ? new Set(options.projects) : null;
  const selected = (project: { id: string; name: string; path: string }) =>
    !only || only.has(project.id) || only.has(project.name) || only.has(project.path);
  const dryRun = Boolean(options.dryRun);
  const results: PropagateResult["projects"][number][] = [];

  for (const loan of listActiveLoansForSkill(ctx.db, skill.id)) {
    const project = findProjectById(ctx.db, loan.projectId);
    if (!project || !selected(project)) continue;
    const entry = { project: project.name, path: project.path };

    if (!(await pathExists(project.path))) {
      results.push({ ...entry, status: "skipped-missing-project" });
      continue;
    }
    const inspection = await inspectBorrowedSkill(ctx, project, name);
    const { content } = inspection.report;
    if (content === "current") {
      results.push({ ...entry, status: "current" });
    } else if (!isClean(content)) {
      results.push({ ...entry, status: "skipped-local-changes" });
    } else {
      if (!dryRun) {
        await moveLoanToRevision(ctx, project, inspection, skill.latestRevision, "loan.updated");
      }
      results.push({ ...entry, status: "updated" });
    }
  }
  return { skill: name, revision: skill.latestRevision, dryRun, projects: results };
}
