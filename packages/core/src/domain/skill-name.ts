import { ShelfError } from "../errors.ts";

/** Agent Skills spec: 1–64 chars of [a-z0-9-], no leading, trailing or doubled hyphen. */
const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_LENGTH = 64;

export function isValidSkillName(name: string): boolean {
  return name.length <= MAX_LENGTH && SKILL_NAME.test(name);
}

export function assertSkillName(name: string): void {
  if (!isValidSkillName(name)) {
    throw new ShelfError(
      "INVALID_ARGUMENT",
      `Invalid skill name "${name}"`,
      "Names are 1-64 lowercase letters, digits and single hyphens, e.g. pdf-tools",
    );
  }
}
