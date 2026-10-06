import { type AddResult, addSkill, audit, type Finding, pullSkill, shortHash } from "@shelf/core";
import { positionals, shelfCommand } from "../command.ts";
import { lines } from "../format.ts";

export function renderFindings(findings: readonly Finding[], indent = "  "): string[] {
  if (findings.length === 0) return [`${indent}no findings`];
  return findings.map(
    (f) =>
      `${indent}${f.severity.toUpperCase().padEnd(6)} ${f.file}${f.line ? `:${f.line}` : ""}  ${f.message}${f.excerpt ? `\n${indent}       ${f.excerpt}` : ""}`,
  );
}

const STATUS_TEXT: Record<AddResult["status"], string> = {
  review: "review only — nothing imported. Re-run with --yes to import",
  blocked: "blocked by high-severity findings. Review them; --yes --force imports anyway",
  imported: "imported into the library",
  linked: "linked to this source (library unchanged). `shelf pull` now fetches its updates",
};

function headline(result: AddResult): string {
  if (result.existing && result.status === "review") {
    return result.diff.length === 0
      ? "already in the library and identical to the source. Re-run with --yes to link them, so `shelf pull` fetches updates"
      : `already in the library; the source differs in ${result.diff.length} file(s). Re-run with --yes to link them (nothing changes until \`shelf pull\`)`;
  }
  return STATUS_TEXT[result.status];
}

export const addCommand = shelfCommand({
  name: "add",
  description: "Import skills from a git repository or directory (reviews first; --yes imports)",
  args: {
    source: {
      type: "positional",
      required: true,
      description: "gh:owner/repo[/path][@ref], a git URL, or a local directory",
    },
    ref: { type: "string", description: "Branch, tag or commit" },
    path: { type: "string", description: "Skill directory inside the source" },
    skill: {
      type: "string",
      description: "Skills to take when the source has several (comma-separated)",
    },
    all: { type: "boolean", description: "Take every skill in the source" },
    yes: { type: "boolean", description: "Import after review" },
    force: { type: "boolean", description: "Import despite high-severity findings" },
  },
  async run(ctx, args) {
    const results = await addSkill(ctx, args.source, {
      yes: Boolean(args.yes),
      force: Boolean(args.force),
      all: Boolean(args.all),
      ...(args.ref ? { ref: args.ref } : {}),
      ...(args.path ? { path: args.path } : {}),
      ...(args.skill ? { skills: args.skill.split(",").map((s) => s.trim()) } : {}),
    });
    return {
      data: { skills: results },
      text: lines(
        ...results.flatMap((result) => [
          `${result.skill} (${result.files.length} file${result.files.length === 1 ? "" : "s"}): ${headline(result)}`,
          ...renderFindings(result.findings),
        ]),
      ),
    };
  },
});

export const pullCommand = shelfCommand({
  name: "pull",
  description: "Update an imported skill from its source (shows diff and audit; --yes applies)",
  args: {
    name: { type: "positional", required: true, description: "Skill name" },
    yes: { type: "boolean", description: "Apply after review" },
    force: {
      type: "boolean",
      description: "Apply despite high-severity findings or library edits since import",
    },
  },
  async run(ctx, args) {
    const result = await pullSkill(ctx, args.name, {
      yes: Boolean(args.yes),
      force: Boolean(args.force),
    });
    const headline = {
      current: `${result.skill} is up to date with ${result.source}`,
      review: `${result.skill}: changes available — nothing applied. Re-run with --yes to apply`,
      blocked: `${result.skill}: blocked by high-severity findings; --yes --force applies anyway`,
      imported: `${result.skill} updated to ${shortHash(result.revision)}. Run \`shelf propagate ${result.skill}\` to update borrowers`,
    }[result.status];
    return {
      data: result,
      text: lines(
        headline,
        ...result.diff.map((file) => file.patch.trimEnd()),
        result.status !== "current" && "Audit:",
        ...(result.status !== "current" ? renderFindings(result.findings) : []),
      ),
    };
  },
});

export const auditCommand = shelfCommand({
  name: "audit",
  description: "Scan library skills for risky content (all, or the named ones)",
  args: { name: { type: "positional", required: false, description: "Skill names" } },
  async run(ctx, args) {
    const results = await audit(ctx, positionals(args));
    const flagged = results.filter((result) => result.findings.length > 0);
    return {
      data: { skills: results },
      text:
        flagged.length === 0
          ? `No findings in ${results.length} skill(s).`
          : lines(
              ...flagged.flatMap((result) => [result.skill, ...renderFindings(result.findings)]),
            ),
    };
  },
});
