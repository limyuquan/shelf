import { catalog, createSkill, shortHash, showSkill } from "@shelf/core";
import { positionals, shelfCommand } from "../command.ts";
import { lines, table, truncate } from "../format.ts";

export const newCommand = shelfCommand({
  name: "new",
  description: "Create a skill in your library",
  args: {
    name: { type: "positional", required: true, description: "Skill name, e.g. pdf-tools" },
    description: {
      type: "string",
      alias: "d",
      required: true,
      description: "When an agent should use this skill (shown in skill listings)",
    },
  },
  async run(ctx, args) {
    const skill = await createSkill(ctx, args.name, args.description);
    const { path } = await showSkill(ctx, skill.name);
    return {
      data: { skill: skill.name, path, revision: skill.latestRevision },
      text: lines(
        `Created ${skill.name} at ${path}`,
        "Edit its files with any editor; shelf records each change as a new revision.",
      ),
    };
  },
});

export const catalogCommand = shelfCommand({
  name: "catalog",
  description: "List library skills, optionally filtered by search terms",
  args: {
    query: { type: "positional", required: false, description: "Search terms (all must match)" },
  },
  async run(ctx, args) {
    const entries = await catalog(ctx, positionals(args).join(" "));
    return {
      data: { skills: entries },
      text:
        entries.length === 0
          ? "No matching skills. Create one with `shelf new <name> -d <description>`."
          : table([
              ["NAME", "TOKENS", "DESCRIPTION"],
              ...entries.map((entry) => [
                entry.name,
                `~${entry.tokens}`,
                truncate(entry.description, 70),
              ]),
            ]),
    };
  },
});

export const showCommand = shelfCommand({
  name: "show",
  description: "Print a library skill's SKILL.md and file list",
  args: { name: { type: "positional", required: true, description: "Skill name" } },
  async run(ctx, args) {
    const skill = await showSkill(ctx, args.name);
    return {
      data: skill,
      text: lines(
        `${skill.name}  rev ${shortHash(skill.revision)}  (${skill.revisions} revisions, ~${skill.tokens} tokens)`,
        `path:  ${skill.path}`,
        `files: ${skill.files.join(", ")}`,
        "",
        skill.content.trimEnd(),
      ),
    };
  },
});
