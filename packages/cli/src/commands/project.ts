import { listProjectOverviews, shortHash, status, sync } from "@shelf/core";
import { shelfCommand } from "../command.ts";
import { formatDate, formatDaysLeft, formatLastUsed, lines, table } from "../format.ts";

export const statusCommand = shelfCommand({
  name: "status",
  description: "Show this project's loans and suggested next steps (returns overdue skills)",
  async run(ctx) {
    const report = await status(ctx);
    if (!report.initialized) {
      return {
        data: report,
        text: `${report.root} does not use shelf yet. Run \`shelf init\` to start.`,
      };
    }
    const loanTable =
      report.loans.length === 0
        ? "No skills borrowed. Find some with `shelf catalog`."
        : table([
            ["SKILL", "CONTENT", "DUE", "", "USED", "POLICY", "REVISION"],
            ...report.loans.map((loan) => [
              loan.skill,
              loan.content,
              formatDate(loan.dueAt),
              formatDaysLeft(loan.daysLeft),
              formatLastUsed(loan.lastUsedAt, new Date()),
              loan.policy,
              shortHash(loan.revision),
            ]),
          ]);
    return {
      data: report,
      text: lines(
        `${report.project.name}  ${report.project.path}`,
        "",
        loanTable,
        report.expired.length > 0 && `\nReturned overdue: ${report.expired.join(", ")}`,
        report.actions.length > 0 && "\nNext steps:",
        ...report.actions.map((action) => `  ${action.command}\n      ${action.reason}`),
        ...report.warnings.map((warning) => `warning: ${warning}`),
      ),
    };
  },
});

export const syncCommand = shelfCommand({
  name: "sync",
  description: "Return overdue skills, restore missing copies, apply updates to --follow loans",
  async run(ctx) {
    const report = await sync(ctx);
    const changes = [
      report.expired.length > 0 && `Returned overdue: ${report.expired.join(", ")}`,
      report.restored.length > 0 && `Restored: ${report.restored.join(", ")}`,
      report.updated.length > 0 && `Updated: ${report.updated.join(", ")}`,
    ].filter(Boolean);
    return {
      data: report,
      text: lines(
        changes.length > 0 ? lines(...changes) : "Everything is in sync.",
        ...report.warnings.map((warning) => `warning: ${warning}`),
      ),
    };
  },
});

export const projectsCommand = shelfCommand({
  name: "projects",
  description: "List every project using shelf, with loan counts",
  async run(ctx) {
    const projects = await listProjectOverviews(ctx);
    return {
      data: { projects },
      text:
        projects.length === 0
          ? "No projects yet. Run `shelf init` inside one."
          : table([
              ["PROJECT", "LOANS", "DUE SOON", "OVERDUE", "PATH"],
              ...projects.map((project) => [
                project.name,
                String(project.loans),
                String(project.dueSoon),
                String(project.overdue),
                project.exists ? project.path : `${project.path} (missing)`,
              ]),
            ]),
    };
  },
});
