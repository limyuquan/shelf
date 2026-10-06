import { addDays, effectiveLoanDays } from "../domain/due.ts";
import type { Project } from "../domain/types.ts";
import { ShelfError } from "../errors.ts";
import { type Lockfile, readLockfile } from "../projection/lockfile.ts";
import { writeTransaction } from "../store/database.ts";
import { recordEvent } from "../store/events.ts";
import { findActiveLoan, setLoanUsed } from "../store/loans.ts";
import { findProjectById } from "../store/projects.ts";
import { findSkillByName } from "../store/skills.ts";
import type { Context } from "./context.ts";
import { findProjectRoot, requireProject } from "./project.ts";

/**
 * Loans renew on use: each recorded use slides the due date to the skill's loan
 * length (`loanDays` unless set per skill) from now, so a loan only expires after
 * going unused for that long. Uses arrive from harness hooks (`shelf hook
 * skill-use`) or from `shelf used`. Kept loans never expire, but uses are still
 * recorded, so the project shows what it actually uses.
 */

/** Uses closer together than this are not written again. */
const USE_RESOLUTION_MS = 60 * 60 * 1000;

export interface UseResult {
  readonly skill: string;
  /** `recent`: a use was already recorded within the last hour; nothing changed. */
  readonly status: "recorded" | "recent";
  readonly dueAt: Date;
}

/** Records that skills borrowed by the current project were used (`shelf used`). */
export async function used(ctx: Context, names: readonly string[]): Promise<UseResult[]> {
  if (names.length === 0) throw new ShelfError("INVALID_ARGUMENT", "Name at least one skill");
  const { project } = await requireProject(ctx);
  for (const name of names) {
    if (!findActiveLoan(ctx.db, project.id, name)) {
      throw new ShelfError(
        "NOT_BORROWED",
        `"${name}" is not borrowed by ${project.name}`,
        "Run `shelf status` to list this project's skills",
      );
    }
  }
  return recordUse(ctx, project, names);
}

export function recordUse(ctx: Context, project: Project, names: readonly string[]): UseResult[] {
  const now = ctx.clock.now();
  const results: UseResult[] = [];
  writeTransaction(ctx.db, () => {
    for (const name of new Set(names)) {
      const loan = findActiveLoan(ctx.db, project.id, name);
      if (!loan) continue;
      if (loan.lastUsedAt && now.getTime() - loan.lastUsedAt.getTime() < USE_RESOLUTION_MS) {
        results.push({ skill: name, status: "recent", dueAt: loan.dueAt });
        continue;
      }
      const skill = findSkillByName(ctx.db, name);
      const slid = addDays(now, skill ? effectiveLoanDays(skill, ctx.config) : ctx.config.loanDays);
      const dueAt = slid > loan.dueAt ? slid : loan.dueAt;
      setLoanUsed(ctx.db, loan.id, now, dueAt);
      // One activity entry per skill per day is enough to see what is in use.
      if (!loan.lastUsedAt || day(loan.lastUsedAt) !== day(now)) {
        recordEvent(ctx.db, {
          type: "loan.used",
          actor: ctx.actor,
          at: now,
          projectId: project.id,
          skillId: loan.skillId,
          detail: { dueAt: dueAt.toISOString() },
        });
      }
      results.push({ skill: name, status: "recorded", dueAt });
    }
  });
  return results;
}

const day = (date: Date) => date.toISOString().slice(0, 10);

/** The parts of a harness hook payload (Claude Code, Codex) that reveal skill use. */
export interface HookPayload {
  readonly cwd?: string;
  readonly tool_name?: string;
  readonly tool_input?: unknown;
  /** UserPromptSubmit: the user may invoke a skill directly, e.g. `/pdf-tools`. */
  readonly prompt?: string;
}

/**
 * Cheap pre-check run before opening any state: most tool calls (edits, searches,
 * ordinary commands) cannot be a skill use, and hooks run on every one of them.
 */
export function mayUseSkill(payload: HookPayload): boolean {
  if (payload.tool_name === "Skill") return true;
  if (payload.prompt !== undefined) return /(^|\s)[/$][\w-]/.test(payload.prompt);
  return collectStrings(payload.tool_input).some((value) => value.includes("skills"));
}

/**
 * Names of the project's borrowed skills that a hook payload shows being used: the
 * Skill tool naming one, a tool reading or listing a file inside its copy (e.g.
 * `.agents/skills/pdf/SKILL.md` via Read or `cat`), or a prompt invoking it.
 */
export function skillsUsedIn(payload: HookPayload, lockfile: Lockfile): string[] {
  const used = new Set<string>();
  const strings = collectStrings(payload.tool_input).map((value) => value.replaceAll("\\", "/"));
  const skillArg = (payload.tool_input as { skill?: unknown } | undefined)?.skill;

  for (const [name, locked] of Object.entries(lockfile.skills)) {
    if (payload.tool_name === "Skill" && skillArg === name) used.add(name);
    if (
      payload.prompt &&
      new RegExp(`(^|\\s)[/$]${escapeRegExp(name)}(?![\\w-])`).test(payload.prompt)
    )
      used.add(name);
    const paths = locked.targets.map((target) => `${target}/${name}`);
    if (strings.some((value) => paths.some((path) => mentionsPath(value, path)))) used.add(name);
  }
  return [...used];
}

/**
 * Records skill uses reported by a harness hook. Silent and cheap by design: no
 * library refresh, no registration, nothing at all outside a shelf project.
 */
export async function recordUseFromHook(ctx: Context, payload: HookPayload): Promise<UseResult[]> {
  const root = await findProjectRoot(payload.cwd ?? ctx.cwd);
  const lockfile = await readLockfile(root);
  if (!lockfile) return [];
  const names = skillsUsedIn(payload, lockfile);
  const project = names.length > 0 ? findProjectById(ctx.db, lockfile.project) : null;
  return project ? recordUse(ctx, project, names) : [];
}

/** `path` appears in `value` as a whole path segment sequence (not `pdf` within `pdf-tools`). */
function mentionsPath(value: string, path: string): boolean {
  for (let at = value.indexOf(path); at >= 0; at = value.indexOf(path, at + 1)) {
    const next = value[at + path.length];
    if (next === undefined || !/[\w.-]/.test(next)) return true;
  }
  return false;
}

/** Every string inside a JSON value, depth-limited. */
function collectStrings(value: unknown, depth = 0): string[] {
  if (typeof value === "string") return [value];
  if (depth > 4 || value === null || typeof value !== "object") return [];
  return Object.values(value).flatMap((item) => collectStrings(item, depth + 1));
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
