import { readdir, rename } from "node:fs/promises";
import { join } from "node:path";
import type { RevisionHash } from "../domain/types.ts";
import type { ShelfPaths } from "../paths.ts";
import { copyDirectory, pathExists, removeDirectory, stagingPath } from "./fs.ts";
import { hashDirectory, revisionKey } from "./hash.ts";
import { SKILL_FILE } from "./skill-file.ts";

/**
 * The library is two directories under SHELF_HOME:
 *  - `library/<name>/`    editable working copy of each skill (edit with any tool)
 *  - `objects/<hash>/`    immutable snapshot of every recorded revision
 * Projects are always materialised from `objects/`, so a loan's base revision is
 * available for diffing even after the library copy moves on.
 */
export function librarySkillPath(paths: ShelfPaths, name: string): string {
  return join(paths.library, name);
}

export function revisionPath(paths: ShelfPaths, hash: RevisionHash): string {
  return join(paths.objects, revisionKey(hash));
}

/** Names of library directories that contain a SKILL.md, sorted. */
export async function listLibrarySkills(paths: ShelfPaths): Promise<string[]> {
  if (!(await pathExists(paths.library))) return [];
  const entries = await readdir(paths.library, { withFileTypes: true });
  const names: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    if (await pathExists(join(paths.library, entry.name, SKILL_FILE))) names.push(entry.name);
  }
  return names.sort();
}

/**
 * Records the library copy of a skill in the object store. The copy is hashed after
 * it is staged, so the stored snapshot always matches its hash even if the library
 * copy is edited concurrently.
 */
export async function snapshotSkill(paths: ShelfPaths, name: string): Promise<RevisionHash> {
  const staging = stagingPath(join(paths.objects, "snapshot"));
  await copyDirectory(librarySkillPath(paths, name), staging);
  const hash = await hashDirectory(staging);
  const target = revisionPath(paths, hash);
  if (await pathExists(target)) {
    await removeDirectory(staging);
  } else {
    await rename(staging, target).catch(async (error) => {
      await removeDirectory(staging);
      // Losing the race to a concurrent snapshot of identical content is fine.
      if (!(await pathExists(target))) throw error;
    });
  }
  return hash;
}
