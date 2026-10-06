import { basename, dirname, relative } from "node:path";

export interface SkillCopyLocation {
  /** Directory holding the harness dir, e.g. `/code/app`. */
  readonly root: string;
  /** Skill directory relative to the root, e.g. `.claude/skills`. */
  readonly target: string;
  readonly name: string;
}

/**
 * Recognises `<root>/.<harness>/skills/<name>`, the layout every harness uses for
 * project skills (`.claude/skills`, `.agents/skills`, `.github/skills`, …).
 * Returns null for skill directories that live anywhere else.
 */
export function locateSkillCopy(skillDir: string): SkillCopyLocation | null {
  const skillsDir = dirname(skillDir);
  const harnessDir = dirname(skillsDir);
  if (basename(skillsDir) !== "skills" || !basename(harnessDir).startsWith(".")) return null;
  const root = dirname(harnessDir);
  return { root, target: relative(root, skillsDir), name: basename(skillDir) };
}
