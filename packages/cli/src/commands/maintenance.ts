import { doctor, sweep } from "@shelf/core";
import bundledSkill from "@shelf/skill/SKILL.md" with { type: "text" };
import { shelfCommand } from "../command.ts";
import { lines } from "../format.ts";
import { resolveHookCommand } from "../hook-command.ts";

export const sweepCommand = shelfCommand({
  name: "sweep",
  description: "Run `sync` in every registered project (e.g. from a daily cron job)",
  async run(ctx) {
    const report = await sweep(ctx);
    const changed = report.synced.filter(
      (sync) => sync.expired.length + sync.restored.length + sync.updated.length > 0,
    );
    return {
      data: report,
      text: lines(
        `Synced ${report.synced.length} project(s).`,
        ...changed.map((sync) =>
          [
            `  ${sync.project.name}:`,
            sync.expired.length > 0 && `returned ${sync.expired.join(", ")}`,
            sync.restored.length > 0 && `restored ${sync.restored.join(", ")}`,
            sync.updated.length > 0 && `updated ${sync.updated.join(", ")}`,
          ]
            .filter(Boolean)
            .join(" "),
        ),
        ...report.missing.map(
          (project) => `  ${project.name}: ${project.path} is missing (\`shelf doctor --fix\`)`,
        ),
      ),
    };
  },
});

export const doctorCommand = shelfCommand({
  name: "doctor",
  description: "Check shelf's state for problems; --fix repairs what it safely can",
  args: { fix: { type: "boolean", description: "Repair fixable problems" } },
  async run(ctx, args) {
    const report = await doctor(ctx, {
      bundledSkill,
      hookCommand: resolveHookCommand(),
      fix: Boolean(args.fix),
    });
    return {
      data: report,
      text: lines(
        ...report.checks.flatMap((check) => [
          `${check.status === "ok" ? "ok  " : "warn"}  ${check.id}: ${check.message}`,
          ...check.problems.map(
            (problem) => `        ${check.fixed.includes(problem) ? "fixed: " : ""}${problem}`,
          ),
        ]),
      ),
    };
  },
});
