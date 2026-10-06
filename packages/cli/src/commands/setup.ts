import { type HookChange, initProject, LOCKFILE_PATH, setup } from "@shelf/core";
import bundledSkill from "@shelf/skill/SKILL.md" with { type: "text" };
import { shelfCommand } from "../command.ts";
import { lines } from "../format.ts";
import { resolveHookCommand } from "../hook-command.ts";

export const setupCommand = shelfCommand({
  name: "setup",
  description:
    "Create the shelf home, install the shelf skill and the hooks that renew skills on use (safe to re-run)",
  args: {
    hooks: {
      type: "boolean",
      default: true,
      description: "Install Claude Code / Codex hooks; --no-hooks removes them",
    },
  },
  async run(ctx, args) {
    const hooks = args.hooks !== false;
    const result = await setup(ctx, {
      bundledSkill,
      hookCommand: resolveHookCommand(),
      hooks,
    });
    return {
      data: result,
      text: lines(
        `Shelf home: ${result.home}`,
        `Library:    ${result.library}`,
        "Installed the shelf skill at:",
        ...result.installed.map((path) => `  ${path}`),
        "",
        ...renderHooks(result.hooks, hooks),
      ),
    };
  },
});

const HOOK_STATUS: Record<HookChange["status"], string> = {
  installed: "hooks installed",
  unchanged: "hooks up to date",
  removed: "hooks removed",
  absent: "no shelf hooks",
  skipped: "skipped",
};

function renderHooks(changes: readonly HookChange[], enabled: boolean): string[] {
  if (changes.length === 0) {
    return enabled
      ? [
          "No Claude Code or Codex config found, so no hooks were installed: run `shelf setup` again after installing one. Until then, loans renew only with `shelf renew` or `shelf used`.",
        ]
      : [];
  }
  return [
    enabled ? "Hooks (renew skills when used, report loans needing attention):" : "Hooks:",
    ...changes.map(
      (change) =>
        `  ${change.label}: ${HOOK_STATUS[change.status]} (${change.file})${change.problem ? ` — ${change.problem}` : ""}`,
    ),
    ...(changes.some((change) => change.needsTrust && change.status === "installed")
      ? ["Codex runs new hooks only after you trust them: open `/hooks` in Codex once."]
      : []),
  ];
}

export const initCommand = shelfCommand({
  name: "init",
  description: `Register the current project with shelf (creates ${LOCKFILE_PATH})`,
  async run(ctx) {
    const { project, created } = await initProject(ctx);
    return {
      data: { project, created },
      text: created ? `Initialized shelf in ${project.path}` : `${project.path} already uses shelf`,
    };
  },
});
