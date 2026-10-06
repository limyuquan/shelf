import { mkdir, rename, symlink } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import type { LoanMode, RevisionHash } from "../domain/types.ts";
import { removeDirectory, replaceDirectory, stagingPath } from "../library/fs.ts";
import { hashDirectoryIfExists } from "../library/hash.ts";

/**
 * Writes and removes the per-harness copies of a skill inside a project.
 *
 * `copy` (default) gives every target its own copy: symlinked skills are
 * unreliable in several harnesses and across the WSL/Windows boundary. `link`
 * keeps one real copy in the first target and points the others at it with
 * relative symlinks, so the project holds a single copy that git can track.
 */
export function skillCopyPath(projectRoot: string, target: string, skillName: string): string {
  return join(projectRoot, target, skillName);
}

export interface Materialization {
  readonly targets: readonly string[];
  readonly mode: LoanMode;
}

/**
 * Writes `sourceDir` into the loan's targets (or just `only`). In link mode the
 * first target is the real copy; the others are (re)created as links to it.
 */
export async function writeSkillCopies(
  projectRoot: string,
  { targets, mode }: Materialization,
  skillName: string,
  sourceDir: string,
  only: readonly string[] = targets,
): Promise<void> {
  const [primary] = targets;
  for (const target of only) {
    const path = skillCopyPath(projectRoot, target, skillName);
    if (mode === "copy" || target === primary || primary === undefined) {
      await replaceDirectory(sourceDir, path);
    } else {
      await replaceWithLink(skillCopyPath(projectRoot, primary, skillName), path);
    }
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

/** Hash of each target copy (following links), `null` where it is absent or dangling. */
export async function hashSkillCopies(
  projectRoot: string,
  targets: readonly string[],
  skillName: string,
): Promise<(RevisionHash | null)[]> {
  return Promise.all(
    targets.map((target) => hashDirectoryIfExists(skillCopyPath(projectRoot, target, skillName))),
  );
}

async function replaceWithLink(targetDir: string, linkPath: string): Promise<void> {
  const staging = stagingPath(linkPath);
  await mkdir(dirname(linkPath), { recursive: true });
  if (process.platform === "win32") {
    // Junctions need no privileges on Windows but must be absolute.
    await symlink(targetDir, staging, "junction");
  } else {
    await symlink(relative(dirname(linkPath), targetDir), staging, "dir");
  }
  await removeDirectory(linkPath);
  await rename(staging, linkPath);
}
