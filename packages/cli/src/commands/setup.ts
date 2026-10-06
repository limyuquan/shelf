import { initProject, LOCKFILE_PATH, setup } from "@shelf/core";
import bundledSkill from "@shelf/skill/SKILL.md" with { type: "text" };
import { shelfCommand } from "../command.ts";
import { lines } from "../format.ts";

export const setupCommand = shelfCommand({
  name: "setup",
  description: "Create the shelf home and install the shelf skill for all agents (safe to re-run)",
  async run(ctx) {
    const result = await setup(ctx, bundledSkill);
    return {
      data: result,
      text: lines(
        `Shelf home: ${result.home}`,
        `Library:    ${result.library}`,
        "Installed the shelf skill at:",
        ...result.installed.map((path) => `  ${path}`),
      ),
    };
  },
});

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
