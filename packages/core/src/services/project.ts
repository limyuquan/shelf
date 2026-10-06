import { basename, dirname, join, resolve } from "node:path";
import { addDays } from "../domain/due.ts";
import type { Project } from "../domain/types.ts";
import { ShelfError } from "../errors.ts";
import { pathExists } from "../library/fs.ts";
import {
  ensureLockfileDir,
  type Lockfile,
  lockfilePath,
  newLockfile,
  readLockfile,
  readLockfileSync,
  writeLockfileSync,
} from "../projection/lockfile.ts";
import { type Db, writeTransaction } from "../store/database.ts";
import { recordEvent } from "../store/events.ts";
import { insertLoan, listActiveLoans } from "../store/loans.ts";
import { findProjectById, upsertProject } from "../store/projects.ts";
import { findSkillByName } from "../store/skills.ts";
import type { Context } from "./context.ts";
import { refreshLibrary } from "./library.ts";

export interface OpenProject {
  readonly project: Project;
  /** Library problems and lockfile entries naming skills this machine does not have. */
  readonly warnings: string[];
}

/**
 * The project root is the nearest ancestor holding a shelf lockfile, else the
 * nearest git root, else the working directory itself.
 */
export async function findProjectRoot(cwd: string): Promise<string> {
  let gitRoot: string | null = null;
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    if (await pathExists(lockfilePath(dir))) return dir;
    if (!gitRoot && (await pathExists(join(dir, ".git")))) gitRoot = dir;
    if (dirname(dir) === dir) return gitRoot ?? resolve(cwd);
  }
}

export async function initProject(ctx: Context): Promise<{ project: Project; created: boolean }> {
  const root = await findProjectRoot(ctx.cwd);
  if (await readLockfile(root)) {
    return { project: (await requireProject(ctx)).project, created: false };
  }
  const lockfile = newLockfile();
  const now = ctx.clock.now();
  const project: Project = {
    id: lockfile.project,
    path: root,
    name: basename(root),
    createdAt: now,
    lastSeenAt: now,
  };
  await ensureLockfileDir(root);
  writeTransaction(ctx.db, () => {
    upsertProject(ctx.db, project);
    recordEvent(ctx.db, {
      type: "project.registered",
      actor: ctx.actor,
      at: now,
      projectId: project.id,
    });
    writeLockfileSync(root, lockfile);
  });
  return { project, created: true };
}

/**
 * Opens the project containing `ctx.cwd`, or returns null if it has no lockfile.
 * Registers the project on first sight (e.g. a fresh clone), follows it if its
 * directory moved, and adopts lockfile entries this machine has no loan for.
 */
export async function openProject(ctx: Context): Promise<OpenProject | null> {
  const root = await findProjectRoot(ctx.cwd);
  const lockfile = await readLockfile(root);
  if (!lockfile) return null;

  // Adoption below needs an up-to-date view of the library.
  const warnings = await refreshLibrary(ctx);
  const now = ctx.clock.now();
  const known = findProjectById(ctx.db, lockfile.project);
  const project: Project = {
    id: lockfile.project,
    path: root,
    name: basename(root),
    createdAt: known?.createdAt ?? now,
    lastSeenAt: now,
  };
  writeTransaction(ctx.db, () => {
    upsertProject(ctx.db, project);
    if (!known) {
      recordEvent(ctx.db, {
        type: "project.registered",
        actor: ctx.actor,
        at: now,
        projectId: project.id,
      });
    }
    for (const name of adoptLockedSkills(ctx, project, lockfile)) {
      warnings.push(`Lockfile lists "${name}", which is not in this machine's library`);
    }
  });
  return { project, warnings };
}

export async function requireProject(ctx: Context): Promise<OpenProject> {
  const opened = await openProject(ctx);
  if (!opened) {
    throw new ShelfError(
      "NOT_INITIALIZED",
      `No shelf project at ${await findProjectRoot(ctx.cwd)}`,
      "Run `shelf init` in the project root",
    );
  }
  return opened;
}

/** Creates loans for lockfile entries without one. Returns names of unknown skills. */
function adoptLockedSkills(ctx: Context, project: Project, lockfile: Lockfile): string[] {
  const active = new Set(listActiveLoans(ctx.db, project.id).map((loan) => loan.skillName));
  const unknown: string[] = [];
  const now = ctx.clock.now();

  for (const [name, locked] of Object.entries(lockfile.skills)) {
    if (active.has(name)) continue;
    const skill = findSkillByName(ctx.db, name);
    if (!skill) {
      unknown.push(name);
      continue;
    }
    insertLoan(ctx.db, {
      projectId: project.id,
      skillId: skill.id,
      revision: locked.revision,
      targets: locked.targets,
      policy: "pinned",
      borrowedAt: now,
      dueAt: addDays(now, ctx.config.loanDays),
    });
    recordEvent(ctx.db, {
      type: "loan.adopted",
      actor: ctx.actor,
      at: now,
      projectId: project.id,
      skillId: skill.id,
      detail: { revision: locked.revision },
    });
  }
  return unknown;
}

/**
 * Rewrites the project's lockfile from its active loans. Entries for skills unknown
 * to this machine are preserved so a clone never loses another machine's loans.
 * Must be called inside a write transaction.
 */
export function syncLockfile(db: Db, project: Project): void {
  const current = readLockfileSync(project.path) ?? { ...newLockfile(), project: project.id };
  const skills: Lockfile["skills"] = {};
  for (const [name, entry] of Object.entries(current.skills)) {
    if (!findSkillByName(db, name)) skills[name] = entry;
  }
  for (const loan of listActiveLoans(db, project.id)) {
    skills[loan.skillName] = { revision: loan.revision, targets: [...loan.targets] };
  }
  writeLockfileSync(project.path, { version: 1, project: project.id, skills });
}
