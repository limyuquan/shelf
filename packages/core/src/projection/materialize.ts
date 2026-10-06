import { mkdir, realpath, rename, symlink } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
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
 * Where a target directory really is, following symlinks in the part of the path
 * that exists. Projects sometimes symlink one harness directory to another (e.g.
 * `.claude/skills` → `.agents/skills`); both names then mean the same directory.
 */
export async function realTargetPath(projectRoot: string, target: string): Promise<string> {
  const missing: string[] = [];
  for (let dir = join(projectRoot, target); ; dir = dirname(dir)) {
    try {
      return join(await realpath(dir), ...missing.reverse());
    } catch {
      if (dirname(dir) === dir) return join(projectRoot, target);
      missing.push(basename(dir));
    }
  }
}

/** Targets without the ones that are the same directory as an earlier target. */
export async function distinctTargets(
  projectRoot: string,
  targets: readonly string[],
): Promise<string[]> {
  const seen = new Set<string>();
  const distinct: string[] = [];
  for (const target of targets) {
    const real = await realTargetPath(projectRoot, target);
    if (seen.has(real)) continue;
    seen.add(real);
    distinct.push(target);
  }
  return distinct;
}

/**
 * Writes `sourceDir` into the loan's targets (or just `only`). In link mode the
 * first target is the real copy; the others are (re)created as links to it.
 * Targets that are another name for an earlier target's directory are skipped.
 */
export async function writeSkillCopies(
  projectRoot: string,
  { targets, mode }: Materialization,
  skillName: string,
  sourceDir: string,
  only: readonly string[] = targets,
): Promise<void> {
  const distinct = await distinctTargets(projectRoot, targets);
  const [primary] = distinct;
  for (const target of only) {
    if (!distinct.includes(target)) continue;
    const path = skillCopyPath(projectRoot, target, skillName);
    if (mode === "copy" || target === primary || primary === undefined) {
      await replaceDirectory(sourceDir, path);
    } else {
      await replaceWithLink(skillCopyPath(projectRoot, primary, skillName), path);
    }
  }
}

/** Removes copies, except where a target is another name for a directory in `keep`. */
export async function removeSkillCopies(
  projectRoot: string,
  targets: readonly string[],
  skillName: string,
  keep: readonly string[] = [],
): Promise<void> {
  const kept = new Set(await Promise.all(keep.map((t) => realTargetPath(projectRoot, t))));
  for (const target of targets) {
    if (kept.has(await realTargetPath(projectRoot, target))) continue;
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
