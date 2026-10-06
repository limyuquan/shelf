import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathExists, removeDirectory, writeFileAtomic } from "../library/fs.ts";
import { revisionKey } from "../library/hash.ts";
import { revisionPath } from "../library/library.ts";
import { lockfilePath } from "../projection/lockfile.ts";
import { writeTransaction } from "../store/database.ts";
import { recordEvent } from "../store/events.ts";
import { listActiveLoanRevisions, listActiveLoans } from "../store/loans.ts";
import { deleteProject, listProjects } from "../store/projects.ts";
import { listAllRevisionHashes } from "../store/skills.ts";
import type { Context } from "./context.ts";
import { refreshLibrary } from "./library.ts";
import { bundledSkillFiles } from "./setup.ts";

export interface DoctorCheck {
  readonly id: string;
  readonly status: "ok" | "warn";
  readonly message: string;
  /** Problems found; with `fix`, the ones that were repaired are repeated in `fixed`. */
  readonly problems: string[];
  readonly fixed: string[];
}

/** Leftovers of interrupted writes: `<name>.shelf-<uuid>`. */
const STAGING = /\.shelf-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Checks shelf's state for problems and, with `fix`, repairs what it safely can. */
export async function doctor(
  ctx: Context,
  options: { bundledSkill: string; fix?: boolean },
): Promise<{ checks: DoctorCheck[] }> {
  const fix = Boolean(options.fix);
  const checks = [
    await checkLibrary(ctx),
    await checkBundledSkill(ctx, options.bundledSkill, fix),
    await checkProjects(ctx, fix),
    await checkStaging(ctx, fix),
    await checkBaseRevisions(ctx),
    await checkObjects(ctx, fix),
  ];
  return { checks };
}

function check(
  id: string,
  okMessage: string,
  problems: string[],
  fixed: string[] = [],
): DoctorCheck {
  const unresolved = problems.length - fixed.length;
  return {
    id,
    status: unresolved > 0 ? "warn" : "ok",
    message:
      problems.length === 0 ? okMessage : `${problems.length} problem(s), ${fixed.length} fixed`,
    problems,
    fixed,
  };
}

async function checkLibrary(ctx: Context): Promise<DoctorCheck> {
  const problems = await refreshLibrary(ctx);
  return check("library", "All library skills are valid", problems);
}

async function checkBundledSkill(
  ctx: Context,
  bundled: string,
  fix: boolean,
): Promise<DoctorCheck> {
  const problems: string[] = [];
  const fixed: string[] = [];
  for (const file of await bundledSkillFiles(ctx)) {
    const current = await readFile(file, "utf8").catch(() => null);
    if (current === bundled) continue;
    const problem = `${file} is ${current === null ? "missing" : "outdated"}`;
    problems.push(problem);
    if (fix) {
      await writeFileAtomic(file, bundled);
      fixed.push(problem);
    }
  }
  return check("bundled-skill", "The shelf skill is installed for every harness", problems, fixed);
}

async function checkProjects(ctx: Context, fix: boolean): Promise<DoctorCheck> {
  const problems: string[] = [];
  const fixed: string[] = [];
  for (const project of listProjects(ctx.db)) {
    if (await pathExists(lockfilePath(project.path))) continue;
    const problem = `${project.name}: ${project.path} no longer has a shelf lockfile`;
    problems.push(problem);
    if (fix) {
      writeTransaction(ctx.db, () => {
        deleteProject(ctx.db, project.id);
        recordEvent(ctx.db, {
          type: "project.forgotten",
          actor: ctx.actor,
          at: ctx.clock.now(),
          projectId: project.id,
          detail: { path: project.path },
        });
      });
      fixed.push(problem);
    }
  }
  return check("projects", "Every registered project exists", problems, fixed);
}

async function checkStaging(ctx: Context, fix: boolean): Promise<DoctorCheck> {
  const dirs = [ctx.paths.library, ctx.paths.objects];
  for (const project of listProjects(ctx.db)) {
    dirs.push(dirname(lockfilePath(project.path)));
    for (const loan of listActiveLoans(ctx.db, project.id)) {
      for (const target of loan.targets) dirs.push(join(project.path, target));
    }
  }
  const problems: string[] = [];
  for (const dir of new Set(dirs)) {
    for (const entry of await readdir(dir).catch(() => [])) {
      if (STAGING.test(entry)) problems.push(join(dir, entry));
    }
  }
  const fixed: string[] = [];
  if (fix) {
    for (const path of problems) {
      await removeDirectory(path);
      fixed.push(path);
    }
  }
  return check("staging", "No leftovers from interrupted writes", problems, fixed);
}

async function checkBaseRevisions(ctx: Context): Promise<DoctorCheck> {
  const problems: string[] = [];
  for (const revision of listActiveLoanRevisions(ctx.db)) {
    if (!(await pathExists(revisionPath(ctx.paths, revision)))) {
      problems.push(
        `Revision ${revisionKey(revision).slice(0, 10)} is borrowed but not stored; \`shelf update\` the affected loans`,
      );
    }
  }
  return check("revisions", "Every borrowed revision is stored", problems);
}

async function checkObjects(ctx: Context, fix: boolean): Promise<DoctorCheck> {
  const known = new Set([...listAllRevisionHashes(ctx.db)].map(revisionKey));
  const problems: string[] = [];
  for (const entry of await readdir(ctx.paths.objects).catch(() => [])) {
    if (!STAGING.test(entry) && !known.has(entry)) problems.push(join(ctx.paths.objects, entry));
  }
  const fixed: string[] = [];
  if (fix) {
    for (const path of problems) {
      await removeDirectory(path);
      fixed.push(path);
    }
  }
  return check("objects", "Every stored snapshot belongs to a revision", problems, fixed);
}
