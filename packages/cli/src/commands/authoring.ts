import { archiveLibrarySkill, duplicateSkill, lintLibrary, renameSkill } from "@shelf/core";
import { positionals, shelfCommand } from "../command.ts";
import { lines } from "../format.ts";

export const renameCommand = shelfCommand({
  name: "rename",
  description: "Rename a library skill (its directory and frontmatter name), keeping its history",
  args: {
    from: { type: "positional", required: true, description: "Current name" },
    to: { type: "positional", required: true, description: "New name" },
  },
  async run(ctx, args) {
    const skill = await renameSkill(ctx, args.from, args.to);
    return {
      data: { from: args.from, skill: skill.name, path: skill.path, revision: skill.revision },
      text: `Renamed ${args.from} to ${skill.name} at ${skill.path}`,
    };
  },
});

export const duplicateCommand = shelfCommand({
  name: "duplicate",
  description: "Copy a library skill to a new name, as a new skill with its own history",
  args: {
    from: { type: "positional", required: true, description: "Skill to copy" },
    to: { type: "positional", required: true, description: "Name of the copy" },
  },
  async run(ctx, args) {
    const skill = await duplicateSkill(ctx, args.from, args.to);
    return {
      data: { from: args.from, skill: skill.name, path: skill.path, revision: skill.revision },
      text: `Copied ${args.from} to ${skill.name} at ${skill.path}`,
    };
  },
});

export const archiveCommand = shelfCommand({
  name: "archive",
  description: "Move a library skill to the archive (nothing is deleted)",
  args: { name: { type: "positional", required: true, description: "Skill name" } },
  async run(ctx, args) {
    const result = await archiveLibrarySkill(ctx, args.name, { reason: "archived with the CLI" });
    return {
      data: result,
      text: lines(
        `Archived ${result.skill} to ${result.path}`,
        "Its revisions are kept. To restore it, move that directory back into the library.",
      ),
    };
  },
});

export const lintCommand = shelfCommand({
  name: "lint",
  description: "Check skills' SKILL.md against the Agent Skills format (exits 1 on errors)",
  args: {
    name: { type: "positional", required: false, description: "Skill names (default: all)" },
  },
  async run(ctx, args) {
    const results = await lintLibrary(ctx, positionals(args));
    const errors = results.flatMap((result) =>
      result.issues.filter((issue) => issue.level === "error"),
    ).length;
    if (errors > 0) process.exitCode = 1;
    return {
      data: { skills: results, errors },
      text: lines(
        ...results.flatMap((result) => [
          `${result.skill}  ~${result.descriptionTokens} description + ~${result.bodyTokens} body tokens${result.issues.length === 0 ? "  ok" : ""}`,
          ...result.issues.map((issue) => `  ${issue.level}: ${issue.message}`),
        ]),
      ),
    };
  },
});
