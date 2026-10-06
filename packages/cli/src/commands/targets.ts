import { changeTargets, describeTargets, type TargetsReport } from "@shelf/core";
import { shelfCommand } from "../command.ts";
import { lines, table } from "../format.ts";

const list = (value: string | undefined) =>
  value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

export const targetsCommand = shelfCommand({
  name: "targets",
  description: "Show or change which harness skill directories this project uses",
  args: {
    add: { type: "string", description: "Harness ids or directories to add (comma-separated)" },
    remove: { type: "string", description: "Harness ids or directories to remove" },
    reset: { type: "boolean", description: "Use your default targets (config) again" },
    force: { type: "boolean", description: "Remove copies even if they have local edits" },
  },
  async run(ctx, args) {
    const changing = Boolean(args.add || args.remove || args.reset);
    const report = changing
      ? await changeTargets(
          ctx,
          { add: list(args.add), remove: list(args.remove), reset: Boolean(args.reset) },
          { force: Boolean(args.force) },
        )
      : await describeTargets(ctx);
    return { data: report, text: render(report) };
  },
});

function render(report: TargetsReport): string {
  const suggestions = report.harnesses.filter((h) => h.detected && !h.enabled && !h.readsAgentsDir);
  return lines(
    `Skills are written to: ${report.targets.join(", ")}${report.custom ? "" : " (your default)"}`,
    "",
    table([
      ["HARNESS", "DIRECTORY", "", "NOTE"],
      ...report.harnesses.map((h) => [
        h.id,
        h.dir,
        h.enabled ? "on" : "",
        [h.readsAgentsDir && !h.enabled ? "reads .agents/skills" : "", h.detected ? "detected" : ""]
          .filter(Boolean)
          .join(", "),
      ]),
    ]),
    ...suggestions.map(
      (h) =>
        `\n${h.label} is used here but does not read .agents/skills: shelf targets --add ${h.id}`,
    ),
  );
}
