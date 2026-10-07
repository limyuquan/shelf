import { type InsightsHere, insightsHere, type ProjectInsight } from "@shelf/core";
import { shelfCommand } from "../command.ts";
import { formatLastUsed, lines, table } from "../format.ts";

const tok = (n: number) => `~${n.toLocaleString("en")}`;

export const insightsCommand = shelfCommand({
  name: "insights",
  description:
    "Context each project loads at session start, and which skills agents actually use (30 days)",
  args: {
    all: { type: "boolean", description: "Every project and skill, even inside a project" },
  },
  async run(ctx, args) {
    const report = await insightsHere(ctx);
    const now = new Date();
    const here = report.currentProject;
    const text =
      here && !args.all
        ? lines(
            renderProject(report, here, now),
            "",
            "Every project and library skill: shelf insights --all",
          )
        : renderOverview(report, now);
    return { data: report, text };
  },
});

function renderProject(report: InsightsHere, project: ProjectInsight, now: Date): string {
  const global = report.globalSkills.map((skill) => skill.name).join(", ");
  return lines(
    `${project.name}: ${tok(project.globalTokens + project.sessionTokens)} tokens of skill descriptions load at every session start`,
    `  ${tok(project.globalTokens)} from skills loaded everywhere${global ? ` (${global})` : ""}`,
    `  ${tok(project.sessionTokens)} from ${project.skills.length} borrowed skill${project.skills.length === 1 ? "" : "s"}; the full SKILL.md loads only when used`,
    project.skills.length > 0 && "",
    project.skills.length > 0 &&
      table([
        ["SKILL", "SESSION", "ON USE", "ACTIVE DAYS (30D)", "LAST USED"],
        ...[...project.skills]
          .sort((a, b) => b.descriptionTokens - a.descriptionTokens)
          .map((skill) => [
            skill.skill,
            tok(skill.descriptionTokens),
            tok(skill.bodyTokens),
            String(skill.activeDays30),
            formatLastUsed(skill.lastUsedAt, now),
          ]),
      ]),
  );
}

function renderOverview(report: InsightsHere, now: Date): string {
  const projects = [...report.projects].sort(
    (a, b) => b.globalTokens + b.sessionTokens - (a.globalTokens + a.sessionTokens),
  );
  const skills = [...report.skills].sort(
    (a, b) => b.activeDays30 - a.activeDays30 || a.name.localeCompare(b.name),
  );
  return lines(
    "Context at session start (skill names and descriptions; tokens estimated as chars / 4)",
    projects.length === 0
      ? "  No projects yet."
      : table([
          ["PROJECT", "TOTAL", "BORROWED", "EVERYWHERE", "SKILLS"],
          ...projects.map((project) => [
            project.name,
            tok(project.globalTokens + project.sessionTokens),
            tok(project.sessionTokens),
            tok(project.globalTokens),
            String(project.skills.length),
          ]),
        ]),
    "",
    "Library skills, last 30 days",
    skills.length === 0
      ? "  Your library is empty."
      : table([
          ["SKILL", "ACTIVE DAYS", "LAST USED", "PROJECTS", "SESSION", "ON USE", ""],
          ...skills.map((skill) => [
            skill.name,
            String(skill.activeDays30),
            formatLastUsed(skill.lastUsedAt, now),
            String(skill.borrowers),
            tok(skill.descriptionTokens),
            tok(skill.bodyTokens),
            skill.neverUsed ? "never used" : skill.activeDays30 === 0 ? "unused 30d" : "",
          ]),
        ]),
    "",
    report.globalSkills.length === 0
      ? "Loaded everywhere: none"
      : `Loaded everywhere (every session, every project): ${report.globalSkills
          .map((skill) => `${skill.name} ${tok(skill.descriptionTokens)}`)
          .join(", ")}`,
  );
}
