import {
  catalog,
  createSkill,
  diffSkill,
  type PropagateResult,
  propagate,
  restoreRevision,
  shortHash,
  showRevision,
  showSkill,
  skillHistory,
} from "@shelf/core";
import { positionals, shelfCommand } from "../command.ts";
import { formatDate, lines, table, truncate } from "../format.ts";

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
  args: {
    name: { type: "positional", required: true, description: "Skill name" },
    revision: {
      type: "string",
      description: "Print this revision instead (hash, unique prefix, or latest; see `shelf log`)",
    },
  },
  async run(ctx, args) {
    if (args.revision) {
      const revision = await showRevision(ctx, args.name, args.revision);
      return {
        data: revision,
        text: lines(
          `${revision.skill}  rev ${shortHash(revision.revision)}${revision.latest ? " (latest)" : ""}  ${formatDate(revision.createdAt)}  ${revision.source}  (~${revision.tokens} tokens)`,
          `files: ${revision.files.join(", ")}`,
          "",
          revision.content.trimEnd(),
        ),
      };
    }
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

export const logCommand = shelfCommand({
  name: "log",
  description: "Show a skill's revisions and which projects borrow each",
  args: { name: { type: "positional", required: true, description: "Skill name" } },
  async run(ctx, args) {
    const history = await skillHistory(ctx, args.name);
    return {
      data: history,
      text: table([
        ["REVISION", "DATE", "SOURCE", "BORROWED BY"],
        ...history.revisions.map((revision) => [
          `${shortHash(revision.hash)}${revision.latest ? " *" : ""}`,
          formatDate(revision.createdAt),
          revision.source,
          revision.borrowers.join(", "),
        ]),
      ]),
    };
  },
});

export const restoreCommand = shelfCommand({
  name: "restore",
  description: "Make an earlier revision of a skill the library's latest again",
  args: {
    name: { type: "positional", required: true, description: "Skill name" },
    revision: {
      type: "positional",
      required: true,
      description: "Revision hash or unique prefix (see `shelf log`)",
    },
  },
  async run(ctx, args) {
    const before = (await showSkill(ctx, args.name)).revision;
    const skill = await restoreRevision(ctx, args.name, args.revision);
    const restored = skill.revision !== before;
    return {
      data: { skill: skill.name, revision: skill.revision, previousRevision: before, restored },
      text: restored
        ? lines(
            `Restored ${skill.name} to rev ${shortHash(skill.revision)} (was ${shortHash(before)}).`,
            "Projects that borrow it keep their revision until they update:",
            `  shelf propagate ${skill.name}`,
          )
        : `${skill.name} is already at rev ${shortHash(skill.revision)}.`,
    };
  },
});

export const diffCommand = shelfCommand({
  name: "diff",
  description: "Diff two versions of a skill: borrowed, library, project, or a revision",
  args: {
    name: { type: "positional", required: true, description: "Skill name" },
    from: { type: "string", description: "borrowed | library | project | <revision>" },
    to: { type: "string", description: "borrowed | library | project | <revision>" },
  },
  async run(ctx, args) {
    const result = await diffSkill(ctx, args.name, {
      ...(args.from ? { from: args.from } : {}),
      ...(args.to ? { to: args.to } : {}),
    });
    return {
      data: result,
      text:
        result.files.length === 0
          ? `No differences between ${result.from.side} and ${result.to.side}.`
          : result.files.map((file) => file.patch.trimEnd()).join("\n"),
    };
  },
});

export const propagateCommand = shelfCommand({
  name: "propagate",
  description: "Push the library's latest revision of a skill to every borrowing project",
  args: {
    name: { type: "positional", required: true, description: "Skill name" },
    project: { type: "string", description: "Limit to these projects (comma-separated names)" },
    "dry-run": { type: "boolean", description: "Show what would change without changing it" },
  },
  async run(ctx, args) {
    const result = await propagate(ctx, args.name, {
      dryRun: Boolean(args["dry-run"]),
      ...(args.project ? { projects: args.project.split(",").map((p) => p.trim()) } : {}),
    });
    return { data: result, text: renderPropagation(result) };
  },
});

export function renderPropagation(result: PropagateResult): string {
  if (result.projects.length === 0) return `No projects borrow ${result.skill}.`;
  const describe = {
    updated: result.dryRun ? "would update" : "updated",
    current: "already current",
    "skipped-local-changes": "skipped (local edits)",
    "skipped-missing-project": "skipped (directory missing)",
  } as const;
  return lines(
    `${result.skill} → ${shortHash(result.revision)}${result.dryRun ? " (dry run)" : ""}`,
    ...result.projects.map((entry) => `  ${entry.project}: ${describe[entry.status]}`),
  );
}
