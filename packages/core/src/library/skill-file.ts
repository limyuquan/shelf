import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { ShelfError } from "../errors.ts";

export const SKILL_FILE = "SKILL.md";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const MAX_DESCRIPTION = 1024;

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
