import type { Insights, ProjectInsight, SkillInsight } from "../../api/types.ts";

/**
 * Pure helpers for the Insights page. Token counts are the server's estimates
 * (characters / 4); everything here only sorts, scales and labels them.
 */

/** "940", "1.2k", "12k". */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) return String(tokens);
  if (tokens < 10_000) return `${(tokens / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${Math.round(tokens / 1000)}k`;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] as number)
    : Math.round(((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2);
}

/** `value` as a percentage of `max`, for bar widths and heights. */
export function scale(value: number, max: number): number {
  return max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
}

/** The smallest 1, 2 or 5 × 10ⁿ at or above `value`: a clean axis maximum. */
export function niceCeil(value: number): number {
  if (value <= 1) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((factor) => factor * magnitude >= value) ?? 10;
  return step * magnitude;
}

/** Tokens loaded when a session starts in a project: global plus borrowed descriptions. */
export const sessionTotal = (project: ProjectInsight) =>
  project.globalTokens + project.sessionTokens;

export interface BudgetRow {
  readonly project: ProjectInsight;
  readonly global: number;
  readonly borrowed: number;
  readonly total: number;
}

/** Projects by what a session costs, most expensive first. */
export function budgetRows(projects: readonly ProjectInsight[]): BudgetRow[] {
  return projects
    .map((project) => ({
      project,
      global: project.globalTokens,
      borrowed: project.sessionTokens,
      total: sessionTotal(project),
    }))
    .sort((a, b) => b.total - a.total || a.project.name.localeCompare(b.project.name));
}

export interface Summary {
  readonly skills: number;
  readonly activeLoans: number;
  readonly projects: number;
  readonly medianSession: number;
  readonly globalTokens: number;
  readonly unused: number;
  readonly neverUsed: number;
}

export function summarize(insights: Insights): Summary {
  return {
    skills: insights.skills.length,
    activeLoans: insights.skills.reduce((total, skill) => total + skill.borrowers, 0),
    projects: insights.projects.length,
    medianSession: median(insights.projects.map(sessionTotal)),
    globalTokens: insights.globalSkills.reduce(
      (total, skill) => total + skill.descriptionTokens,
      0,
    ),
    unused: insights.skills.filter((skill) => skill.activeDays30 === 0).length,
    neverUsed: insights.skills.filter((skill) => skill.neverUsed).length,
  };
}

export type SkillSort = "active" | "lastUsed" | "session" | "body" | "borrowers";

export const SKILL_SORTS: { value: SkillSort; label: string }[] = [
  { value: "active", label: "Active days" },
  { value: "lastUsed", label: "Last used" },
  { value: "session", label: "Session cost" },
  { value: "body", label: "Body size" },
  { value: "borrowers", label: "Borrowers" },
];

const sortValue: Record<SkillSort, (skill: SkillInsight) => number> = {
  active: (skill) => skill.activeDays30,
  lastUsed: (skill) => (skill.lastUsedAt ? new Date(skill.lastUsedAt).getTime() : -1),
  session: (skill) => skill.descriptionTokens,
  body: (skill) => skill.bodyTokens,
  borrowers: (skill) => skill.borrowers,
};

/** Largest first (most recent for last used, never-used last); ties by name. */
export function sortSkills(skills: readonly SkillInsight[], by: SkillSort): SkillInsight[] {
  const value = sortValue[by];
  return [...skills].sort((a, b) => value(b) - value(a) || a.name.localeCompare(b.name));
}

/** "never used" or "unused 30d" — the skills worth returning or deleting. */
export function usageBadge(skill: SkillInsight): "never used" | "unused 30d" | null {
  if (skill.neverUsed) return "never used";
  if (skill.activeDays30 === 0) return "unused 30d";
  return null;
}

/** "Oct 5" for a `YYYY-MM-DD` day. The server buckets days in UTC, so format in UTC. */
export function dayLabel(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Names of the skills used on day `index` of the window. */
export function skillsUsedOn(skills: readonly SkillInsight[], index: number): string[] {
  return skills.filter((skill) => (skill.daily[index] ?? 0) > 0).map((skill) => skill.name);
}

export const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;
