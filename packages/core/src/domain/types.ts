/** Content hash of a skill directory, e.g. `sha256:9f86d0…`. */
export type RevisionHash = string;

/** Who performed an action, e.g. `user`, `agent:claude-code`. Recorded in the event log. */
export type Actor = string;

export type LoanPolicy = "pinned" | "follow";

/**
 * `copy`: every target holds its own copy. `link`: the first target holds the copy
 * and the others are relative symlinks to it (one copy per project).
 */
export type LoanMode = "copy" | "link";

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

/** `adopt`: an older, unedited version of a library skill found in a project. */
export type RevisionSource = "library" | "promote" | "import" | "adopt";

export interface Loan {
  readonly id: number;
  readonly projectId: string;
  readonly skillId: number;
  readonly skillName: string;
  readonly revision: RevisionHash;
  readonly targets: readonly string[];
  readonly policy: LoanPolicy;
  readonly mode: LoanMode;
  readonly borrowedAt: Date;
  readonly dueAt: Date;
  /** Last time an agent was seen using the skill in this project (see `recordUse`). */
  readonly lastUsedAt: Date | null;
  readonly returnedAt: Date | null;
}

export type EventType =
  | "skill.created"
  | "skill.revised"
  | "skill.archived"
  | "skill.linked"
  | "project.registered"
  | "project.forgotten"
  | "loan.borrowed"
  | "loan.adopted"
  | "loan.due-changed"
  | "loan.updated"
  | "loan.used"
  | "loan.restored"
  | "loan.returned"
  | "loan.expired"
  | "loan.detached";
