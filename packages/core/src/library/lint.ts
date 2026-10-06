import { isValidSkillName } from "../domain/skill-name.ts";
import { FRONTMATTER, MAX_DESCRIPTION } from "./skill-file.ts";

export interface LintIssue {
  readonly level: "error" | "warning";
  readonly message: string;
}

export interface LintResult {
  readonly issues: LintIssue[];
  /** What the description costs in every session (chars / 4, like insights). */
  readonly descriptionTokens: number;
  /** What loading the skill's instructions costs on top of that. */
  readonly bodyTokens: number;
}

/**
 * Descriptions are loaded into every session, so past this length they cost more
 * than they help an agent decide.
 */
const LONG_DESCRIPTION = 300;
/** "Use when…", "when to use", "whenever…": agents pick skills by such triggers. */
const TRIGGER_HINT = /\bwhen(ever)?\b|\bif (you|the user)\b|\buse (it |this )?(for|to)\b/i;

const tokens = (text: string) => Math.ceil(text.trim().length / 4);

/**
 * Checks a SKILL.md against the Agent Skills format and shelf's conventions.
 * Pure, so the dashboard can lint an unsaved draft. Errors make the skill invalid;
 * warnings make it costly or hard for an agent to pick.
 */
export function lintSkill(content: string, directory?: string): LintResult {
  const issues: LintIssue[] = [];
  const error = (message: string) => issues.push({ level: "error", message });
  const warning = (message: string) => issues.push({ level: "warning", message });

  const match = FRONTMATTER.exec(content);
  const body = match ? content.slice(match[0].length) : content;
  let description = "";

  if (!match?.[1]) {
    error("SKILL.md must start with YAML frontmatter between --- lines");
  } else {
    let frontmatter: unknown = null;
    try {
      frontmatter = Bun.YAML.parse(match[1]);
    } catch (cause) {
      error(`Frontmatter is not valid YAML: ${cause instanceof Error ? cause.message : cause}`);
    }
    if (frontmatter !== null && (typeof frontmatter !== "object" || Array.isArray(frontmatter))) {
      error("Frontmatter must be key: value pairs");
    } else if (frontmatter) {
      const fields = frontmatter as Record<string, unknown>;
      lintName(fields.name, directory, error);
      if (typeof fields.description === "string") description = fields.description.trim();
      lintDescription(fields.description, description, error, warning);
    }
  }
  if (body.trim() === "") warning("The body is empty: add the instructions an agent follows");

  return { issues, descriptionTokens: tokens(description), bodyTokens: tokens(body) };
}

function lintName(name: unknown, directory: string | undefined, error: (m: string) => void) {
  if (name === undefined || name === null || name === "") return error("name is required");
  if (typeof name !== "string") return error("name must be a string");
  if (name.length > 64) return error(`name is ${name.length} characters; the limit is 64`);
  if (!isValidSkillName(name)) {
    return error("name must be lowercase letters, digits and single hyphens, e.g. pdf-tools");
  }
  if (directory !== undefined && name !== directory) {
    error(`name "${name}" must match the skill's directory "${directory}"`);
  }
}

function lintDescription(
  value: unknown,
  description: string,
  error: (m: string) => void,
  warning: (m: string) => void,
) {
  if (value !== undefined && value !== null && typeof value !== "string") {
    return error("description must be a string");
  }
  if (description === "") return error("description is required");
  if (description.length > MAX_DESCRIPTION) {
    return error(
      `description is ${description.length} characters; the limit is ${MAX_DESCRIPTION}`,
    );
  }
  if (description.length > LONG_DESCRIPTION) {
    warning(
      `description is ${description.length} characters; every session loads it, so aim for under ${LONG_DESCRIPTION}`,
    );
  }
  if (!TRIGGER_HINT.test(description)) {
    warning('description doesn\'t say when to use the skill: add "Use when …"');
  }
}
