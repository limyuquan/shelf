/** Content hash of a skill directory, e.g. `sha256:9f86d0…`. */
export type RevisionHash = string;

/** Who performed an action, e.g. `user`, `agent:claude-code`. Recorded in the event log. */
export type Actor = string;

export type LoanPolicy = "pinned" | "follow";

/** How close a loan is to its due date. */
export type DueState = "active" | "due-soon" | "overdue";

/**
 * How a project's copy relates to the library, from three hashes:
 * the revision borrowed (base), the library's latest (head), and the files on disk.
 */
export type ContentState = "current" | "behind" | "modified" | "diverged" | "missing";

export interface Project {
  readonly id: string;
  readonly path: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
}

export interface Skill {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly latestRevision: RevisionHash;
  readonly createdAt: Date;
  readonly archivedAt: Date | null;
}

export type RevisionSource = "library" | "promote";

export interface Loan {
  readonly id: number;
  readonly projectId: string;
  readonly skillId: number;
  readonly skillName: string;
  readonly revision: RevisionHash;
  readonly targets: readonly string[];
  readonly policy: LoanPolicy;
  readonly borrowedAt: Date;
  readonly dueAt: Date;
  readonly returnedAt: Date | null;
}

export type EventType =
  | "skill.created"
  | "skill.revised"
  | "skill.archived"
  | "project.registered"
  | "loan.borrowed"
  | "loan.adopted"
  | "loan.due-changed"
  | "loan.updated"
  | "loan.restored"
  | "loan.returned"
  | "loan.expired"
  | "loan.detached";
