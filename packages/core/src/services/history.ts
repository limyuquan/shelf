import type { RevisionHash, RevisionSource } from "../domain/types.ts";
import { listActiveLoansForSkill } from "../store/loans.ts";
import { findProjectById } from "../store/projects.ts";
import { listRevisions } from "../store/skills.ts";
import type { Context } from "./context.ts";
import { refreshLibrary, requireSkill } from "./library.ts";

export interface SkillHistory {
  readonly skill: string;
  readonly revisions: {
    readonly hash: RevisionHash;
    readonly parent: RevisionHash | null;
    readonly source: RevisionSource;
    readonly createdAt: Date;
    readonly latest: boolean;
    /** Projects whose loan is based on this revision. */
    readonly borrowers: string[];
  }[];
  readonly borrowers: {
    readonly project: string;
    readonly path: string;
    readonly revision: RevisionHash;
    readonly onLatest: boolean;
    readonly dueAt: Date;
  }[];
}

/** A skill's revisions, most recently recorded first, and which projects borrow which revision. */
export async function skillHistory(ctx: Context, name: string): Promise<SkillHistory> {
  await refreshLibrary(ctx);
  const skill = requireSkill(ctx, name);
  const borrowers = listActiveLoansForSkill(ctx.db, skill.id).flatMap((loan) => {
    const project = findProjectById(ctx.db, loan.projectId);
    if (!project) return [];
    return [
      {
        project: project.name,
        path: project.path,
        revision: loan.revision,
        onLatest: loan.revision === skill.latestRevision,
        dueAt: loan.dueAt,
      },
    ];
  });
  const revisions = listRevisions(ctx.db, skill.id).map((revision) => ({
    ...revision,
    latest: revision.hash === skill.latestRevision,
    borrowers: borrowers.filter((b) => b.revision === revision.hash).map((b) => b.project),
  }));
  return { skill: name, revisions, borrowers };
}
