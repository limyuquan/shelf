import { randomUUID } from "node:crypto";
import { access, cp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";

/** OS clutter that is never copied and never changes a skill's identity. */
export const IGNORED_FILES: ReadonlySet<string> = new Set([
  ".DS_Store",
  "Thumbs.db",
  "desktop.ini",
]);

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function stagingPath(dest: string): string {
  return `${dest}.shelf-${randomUUID()}`;
}

export async function copyDirectory(src: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  await cp(src, dest, { recursive: true, filter: (path) => !IGNORED_FILES.has(basename(path)) });
}

/**
 * Replaces `dest` with a copy of `src`. The copy is staged next to the destination
 * and renamed into place, so readers never observe a half-written skill.
 */
export async function replaceDirectory(src: string, dest: string): Promise<void> {
  const staging = stagingPath(dest);
  await copyDirectory(src, staging);
  await rm(dest, { recursive: true, force: true });
  await rename(staging, dest);
}

/** Writes a file via a temp file + rename so concurrent readers see old or new, never partial. */
export async function writeFileAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const staging = stagingPath(path);
  await writeFile(staging, content);
  await rename(staging, path);
}

export async function removeDirectory(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}
