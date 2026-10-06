import { join } from "node:path";
import type { RevisionHash } from "../domain/types.ts";
import { removeDirectory, replaceDirectory } from "../library/fs.ts";
import { hashDirectoryIfExists } from "../library/hash.ts";

/**
 * Writes and removes the per-harness copies of a skill inside a project.
 * Copies (not symlinks) by default: symlinked skills are unreliable in several
 * harnesses and across the WSL/Windows boundary.
 */
export function skillCopyPath(projectRoot: string, target: string, skillName: string): string {
  return join(projectRoot, target, skillName);
}

export async function writeSkillCopies(
  projectRoot: string,
  targets: readonly string[],
  skillName: string,
  sourceDir: string,
): Promise<void> {
  for (const target of targets) {
    await replaceDirectory(sourceDir, skillCopyPath(projectRoot, target, skillName));
  }
}

export async function removeSkillCopies(
  projectRoot: string,
  targets: readonly string[],
  skillName: string,
): Promise<void> {
  for (const target of targets) {
    await removeDirectory(skillCopyPath(projectRoot, target, skillName));
  }
}

/** Hash of each target copy, `null` where the copy does not exist. */
export async function hashSkillCopies(
  projectRoot: string,
  targets: readonly string[],
  skillName: string,
): Promise<(RevisionHash | null)[]> {
  return Promise.all(
    targets.map((target) => hashDirectoryIfExists(skillCopyPath(projectRoot, target, skillName))),
  );
}
