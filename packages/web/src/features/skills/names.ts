/** Agent Skills names: 1–64 lowercase letters, digits and single hyphens (as in core). */
const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MAX_NAME = 64;
export const MAX_DESCRIPTION = 1024;
/** Descriptions load into every session; past this they cost more than they help. */
export const LONG_DESCRIPTION = 300;

/**
 * What's wrong with a new skill name, for live feedback; null when it's fine or
 * still empty. The server checks again (archived names, races).
 */
export function skillNameProblem(name: string, taken: readonly string[] = []): string | null {
  if (name === "") return null;
  if (name.length > MAX_NAME) return `${MAX_NAME} characters at most`;
  if (/[^a-z0-9-]/.test(name)) return "Only lowercase letters, digits and hyphens";
  if (!SKILL_NAME.test(name)) return "Hyphens go between words, one at a time";
  if (taken.includes(name)) return `Your library already has ${name}`;
  return null;
}

/** Typing "PDF Tools" gives "pdf-tools": names are lowercase with hyphens. */
export function normalizeNameInput(value: string): string {
  return value.toLowerCase().replace(/[\s_]+/g, "-");
}

/** The same estimate as the server's: characters / 4. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.trim().length / 4);
}
