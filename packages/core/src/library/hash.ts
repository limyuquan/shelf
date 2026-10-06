import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RevisionHash } from "../domain/types.ts";
import { IGNORED_FILES, pathExists } from "./fs.ts";

/**
 * Content hash of a directory: SHA-256 over every file's relative POSIX path and
 * the SHA-256 of its bytes, in sorted order. Byte-exact — no newline normalisation —
 * so any edit, however small, is detected.
 */
export async function hashDirectory(dir: string): Promise<RevisionHash> {
  const files = await listFiles(dir);
  const digest = createHash("sha256");
  for (const relative of files) {
    const content = await readFile(join(dir, relative));
    const fileHash = createHash("sha256").update(content).digest("hex");
    digest.update(`${relative}\0${fileHash}\n`);
  }
  return `sha256:${digest.digest("hex")}`;
}

export async function hashDirectoryIfExists(dir: string): Promise<RevisionHash | null> {
  return (await pathExists(dir)) ? hashDirectory(dir) : null;
}

/** The hex part of a revision hash, used as its directory name in the object store. */
export function revisionKey(hash: RevisionHash): string {
  return hash.replace(/^sha256:/, "");
}

export function shortHash(hash: RevisionHash): string {
  return revisionKey(hash).slice(0, 10);
}

async function listFiles(dir: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(join(dir, prefix), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (IGNORED_FILES.has(entry.name)) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await listFiles(dir, relative)));
    else files.push(relative);
  }
  return files.sort();
}
