import { readdir, readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import type { Skill } from "../domain/types.ts";
import { pathExists } from "../library/fs.ts";
import { librarySkillPath, revisionPath } from "../library/library.ts";
import { parseSkillMetadata, SKILL_FILE } from "../library/skill-file.ts";
import { HARNESSES } from "../projection/harnesses.ts";
import { readLockfile } from "../projection/lockfile.ts";
import { listUseDays } from "../store/events.ts";
import { listActiveLoans, listSkillLoanStats } from "../store/loans.ts";
import { listProjects } from "../store/projects.ts";
import { listSkills } from "../store/skills.ts";
import type { Context } from "./context.ts";
import { refreshLibrary } from "./library.ts";
import { findProjectRoot } from "./project.ts";
import { bundledSkillFiles } from "./setup.ts";

/**
 * What skills cost and how much they are used. Agents load every available skill's
 * name and description at session start and read the full SKILL.md only when they
 * use it, so a skill's *session cost* is its description and its *use cost* its body.
 *
 * Token counts are estimates, characters / 4 rounded up (as `catalog` does): good
 * enough to compare skills and projects, not a tokenizer.
 */
export const INSIGHT_DAYS = 30;

export interface GlobalSkill {
  readonly name: string;
  /** User-level skill directories holding it, relative to the home directory. */
  readonly harnessDirs: string[];
  readonly descriptionTokens: number;
  readonly bodyTokens: number;
  /** shelf's own skill, installed by `shelf setup`. */
  readonly bundled: boolean;
}

export interface ProjectSkillInsight {
  readonly skill: string;
  readonly descriptionTokens: number;
  readonly bodyTokens: number;
  readonly lastUsedAt: Date | null;
  /** Days in the window on which an agent used the skill in this project. */
  readonly activeDays30: number;
}

export interface ProjectInsight {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly skills: ProjectSkillInsight[];
  /** Descriptions of the project's borrowed skills: what it adds to every session. */
  readonly sessionTokens: number;
  /** Descriptions of the user-level skills, loaded in this project like in every other. */
  readonly globalTokens: number;
}

export interface SkillInsight {
  readonly name: string;
  readonly descriptionTokens: number;
  readonly bodyTokens: number;
  /** Projects borrowing it now. */
  readonly borrowers: number;
  /** Days in the window on which any project used it. */
  readonly activeDays30: number;
  readonly lastUsedAt: Date | null;
  readonly neverUsed: boolean;
  /** Projects that used it on each day of the window, oldest first. */
  readonly daily: number[];
}

export interface Insights {
  readonly globalSkills: GlobalSkill[];
  /** User-level skill directories with an invalid SKILL.md (left out of `globalSkills`). */
  readonly invalidGlobalSkills: number;
  /** Registered projects whose directory exists. */
  readonly projects: ProjectInsight[];
  /** Every library skill. */
  readonly skills: SkillInsight[];
  readonly usage: {
    /** The window's UTC dates, oldest first (the last is today). */
    readonly days: string[];
    /** Distinct skills used on each day, in any project. */
    readonly active: number[];
  };
}

export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

/** What a skill adds to every session: its name and description. */
const descriptionTokens = (name: string, description: string) => estimateTokens(name + description);

/** Read-only apart from the usual library reconciliation: never syncs or expires loans. */
export async function insights(ctx: Context): Promise<Insights> {
  await refreshLibrary(ctx);
  const library = listSkills(ctx.db);
  const days = windowDays(ctx.clock.now());
  const dayIndex = new Map(days.map((day, index) => [day, index]));

  // One pass over the window's uses: days per loan, projects per skill per day, skills per day.
  const loanDays = new Map<string, number>();
  const skillDaily = new Map<number, number[]>();
  const activeSkills = days.map(() => new Set<number>());
  for (const use of listUseDays(ctx.db, new Date(`${days[0]}T00:00:00.000Z`))) {
    const index = dayIndex.get(use.day);
    if (index === undefined) continue;
    const key = loanKey(use.projectId, use.skillId);
    loanDays.set(key, (loanDays.get(key) ?? 0) + 1);
    const daily = skillDaily.get(use.skillId) ?? days.map(() => 0);
    daily[index] = (daily[index] ?? 0) + 1;
    skillDaily.set(use.skillId, daily);
    activeSkills[index]?.add(use.skillId);
  }

  const { skills: globalSkills, invalid } = await scanGlobalSkills(ctx);
  const globalTokens = sum(globalSkills.map((skill) => skill.descriptionTokens));

  const projects: ProjectInsight[] = [];
  for (const project of listProjects(ctx.db)) {
    if (!(await pathExists(project.path))) continue;
    const skills = await Promise.all(
      listActiveLoans(ctx.db, project.id).map(async (loan) => ({
        skill: loan.skillName,
        ...(await borrowedCost(
          ctx,
          loan.revision,
          loan.skillName,
          library.find((skill) => skill.id === loan.skillId),
        )),
        lastUsedAt: loan.lastUsedAt,
        activeDays30: loanDays.get(loanKey(project.id, loan.skillId)) ?? 0,
      })),
    );
    projects.push({
      id: project.id,
      name: project.name,
      path: project.path,
      skills,
      sessionTokens: sum(skills.map((skill) => skill.descriptionTokens)),
      globalTokens,
    });
  }

  const stats = listSkillLoanStats(ctx.db);
  const skills = await Promise.all(
    library.map(async (skill): Promise<SkillInsight> => {
      const body = await readFile(
        join(librarySkillPath(ctx.paths, skill.name), SKILL_FILE),
        "utf8",
      ).catch(() => "");
      const daily = skillDaily.get(skill.id) ?? days.map(() => 0);
      const lastUsedAt = stats.get(skill.id)?.lastUsedAt ?? null;
      return {
        name: skill.name,
        descriptionTokens: descriptionTokens(skill.name, skill.description),
        bodyTokens: estimateTokens(body),
        borrowers: stats.get(skill.id)?.borrowers ?? 0,
        activeDays30: daily.filter((count) => count > 0).length,
        lastUsedAt,
        neverUsed: lastUsedAt === null,
        daily,
      };
    }),
  );

  return {
    globalSkills,
    invalidGlobalSkills: invalid,
    projects,
    skills,
    usage: { days, active: activeSkills.map((set) => set.size) },
  };
}

const loanKey = (projectId: string, skillId: number) => `${projectId}:${skillId}`;

/** The last `INSIGHT_DAYS` UTC dates (the days `loan.used` events are logged by), oldest first. */
function windowDays(now: Date): string[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: INSIGHT_DAYS }, (_, index) =>
    new Date(today - (INSIGHT_DAYS - 1 - index) * 86_400_000).toISOString().slice(0, 10),
  );
}

/**
 * A loan costs what the project actually has: the borrowed revision's SKILL.md
 * from the object store, which may be older than the library's. The library copy
 * stands in for a revision missing from the store.
 */
async function borrowedCost(
  ctx: Context,
  revision: string,
  name: string,
  skill: Skill | undefined,
): Promise<{ descriptionTokens: number; bodyTokens: number }> {
  const read = (dir: string) => readFile(join(dir, SKILL_FILE), "utf8").catch(() => null);
  const source =
    (await read(revisionPath(ctx.paths, revision))) ??
    (await read(librarySkillPath(ctx.paths, name))) ??
    "";
  let description = skill?.description ?? "";
  try {
    description = parseSkillMetadata(source, name, SKILL_FILE).description;
  } catch {
    // Keep the library's description: the estimate matters more than validity here.
  }
  return {
    descriptionTokens: descriptionTokens(name, description),
    bodyTokens: estimateTokens(source),
  };
}

/**
 * Skills in the harnesses' user-level directories (e.g. `~/.claude/skills`), which
 * load in every project. Directories that are aliases of one another (symlinks) are
 * read once. A skill in several directories is one entry, counted once: a session
 * runs in one harness, so this is an upper bound for any single session.
 */
async function scanGlobalSkills(ctx: Context): Promise<{ skills: GlobalSkill[]; invalid: number }> {
  const dirs = new Map<string, string[]>();
  for (const userDir of new Set(HARNESSES.map((harness) => harness.userDir))) {
    const real = await realpath(join(ctx.paths.userHome, userDir)).catch(() => null);
    if (real) dirs.set(real, [...(dirs.get(real) ?? []), userDir]);
  }

  const bundledFiles = new Set(await bundledSkillFiles(ctx));
  const found = new Map<string, GlobalSkill>();
  const invalid = new Set<string>();
  for (const [dir, labels] of dirs) {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const file = join(dir, entry.name, SKILL_FILE);
      const source = await readFile(file, "utf8").catch(() => null);
      if (source === null) continue; // not a skill, or a dangling link
      let description: string;
      try {
        ({ description } = parseSkillMetadata(source, entry.name, file));
      } catch {
        invalid.add(await realpath(join(dir, entry.name)));
        continue;
      }
      const bundled =
        entry.name === "shelf" &&
        labels.some((label) =>
          bundledFiles.has(join(ctx.paths.userHome, label, entry.name, SKILL_FILE)),
        );
      const existing = found.get(entry.name);
      found.set(entry.name, {
        name: entry.name,
        harnessDirs: [...(existing?.harnessDirs ?? []), ...labels],
        descriptionTokens:
          existing?.descriptionTokens ?? descriptionTokens(entry.name, description),
        bodyTokens: existing?.bodyTokens ?? estimateTokens(source),
        bundled: (existing?.bundled ?? false) || bundled,
      });
    }
  }
  const skills = [...found.values()].sort(
    (a, b) => b.descriptionTokens - a.descriptionTokens || a.name.localeCompare(b.name),
  );
  return { skills, invalid: invalid.size };
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

export interface InsightsHere extends Insights {
  /** The registered project containing the working directory, if any. */
  readonly currentProject: ProjectInsight | null;
}

/** `insights` plus the project the caller is in (for `shelf insights` inside a project). */
export async function insightsHere(ctx: Context): Promise<InsightsHere> {
  const report = await insights(ctx);
  const lockfile = await readLockfile(await findProjectRoot(ctx.cwd));
  const currentProject = report.projects.find((project) => project.id === lockfile?.project);
  return { ...report, currentProject: currentProject ?? null };
}
