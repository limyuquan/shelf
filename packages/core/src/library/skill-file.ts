import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { ShelfError } from "../errors.ts";

export const SKILL_FILE = "SKILL.md";

/** The YAML frontmatter block at the top of a SKILL.md; group 1 is its body. */
export const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
export const MAX_DESCRIPTION = 1024;

export interface SkillMetadata {
  readonly name: string;
  readonly description: string;
}

/** Reads and validates a skill directory's SKILL.md frontmatter against the Agent Skills spec. */
export async function readSkillMetadata(dir: string): Promise<SkillMetadata> {
  const file = join(dir, SKILL_FILE);
  let source: string;
  try {
    source = await readFile(file, "utf8");
  } catch {
    throw new ShelfError("INVALID_SKILL", `${file} does not exist`);
  }
  return parseSkillMetadata(source, basename(dir), file);
}

export function parseSkillMetadata(source: string, dirName: string, file: string): SkillMetadata {
  const match = FRONTMATTER.exec(source);
  if (!match?.[1]) throw new ShelfError("INVALID_SKILL", `${file} has no YAML frontmatter`);

  let frontmatter: unknown;
  try {
    frontmatter = Bun.YAML.parse(match[1]);
  } catch (error) {
    throw new ShelfError("INVALID_SKILL", `${file} has invalid YAML frontmatter: ${error}`);
  }
  const { name, description } = (frontmatter ?? {}) as Record<string, unknown>;

  if (name !== dirName) {
    throw new ShelfError(
      "INVALID_SKILL",
      `${file}: frontmatter name "${String(name)}" must match its directory "${dirName}"`,
    );
  }
  if (typeof description !== "string" || description.trim() === "") {
    throw new ShelfError("INVALID_SKILL", `${file}: description is required`);
  }
  if (description.length > MAX_DESCRIPTION) {
    throw new ShelfError("INVALID_SKILL", `${file}: description exceeds ${MAX_DESCRIPTION} chars`);
  }
  return { name, description: description.trim() };
}

export function renderSkillTemplate(name: string, description: string): string {
  return `---
name: ${name}
description: ${JSON.stringify(description)}
---

# ${name}

Describe when and how an agent should apply this skill.
`;
}

/**
 * Changes the frontmatter `name:` value from `from` to `to`, leaving every other
 * byte as it was (quoting style included), so a rename is the smallest possible edit.
 */
export function setFrontmatterName(source: string, from: string, to: string, file: string): string {
  const match = FRONTMATTER.exec(source);
  if (!match?.[1]) throw new ShelfError("INVALID_SKILL", `${file} has no YAML frontmatter`);
  const start = match[0].indexOf(match[1]);
  const line = new RegExp(`^(name[ \\t]*:[ \\t]*)(["']?)${from}\\2([ \\t]*(?:#.*)?)$`, "m");
  const found = line.exec(match[1]);
  if (!found) {
    throw new ShelfError(
      "INVALID_SKILL",
      `${file}: can't find "name: ${from}" in the frontmatter`,
      "Edit the name by hand, then rename the directory to match",
    );
  }
  // A bare 123 or true would be read back as a number or boolean, not a name.
  const quote = found[2] || (plainYamlString(to) ? "" : '"');
  const block = match[1].replace(
    line,
    (_, key: string, _quote: string, rest: string) => `${key}${quote}${to}${quote}${rest}`,
  );
  return source.slice(0, start) + block + source.slice(start + match[1].length);
}

function plainYamlString(value: string): boolean {
  try {
    return (Bun.YAML.parse(`v: ${value}`) as { v: unknown }).v === value;
  } catch {
    return false;
  }
}
