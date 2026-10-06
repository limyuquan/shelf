import { randomUUID } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { ShelfError } from "../errors.ts";

/**
 * `<project>/.agents/shelf.lock.json` records which skills shelf manages in a
 * project and at which revision. It holds no timestamps, so renewals never touch
 * it and committing it causes no merge churn. Due dates live in the database.
 */
export const LOCKFILE_PATH = ".agents/shelf.lock.json";

const LockedSkillSchema = z.object({
  revision: z.string().startsWith("sha256:"),
  targets: z.array(z.string()).min(1),
});

const LockfileSchema = z.object({
  version: z.literal(1),
  project: z.uuid(),
  skills: z.record(z.string(), LockedSkillSchema),
});

export type LockedSkill = z.infer<typeof LockedSkillSchema>;
export type Lockfile = z.infer<typeof LockfileSchema>;

export function lockfilePath(projectRoot: string): string {
  return join(projectRoot, LOCKFILE_PATH);
}

export function newLockfile(): Lockfile {
  return { version: 1, project: randomUUID(), skills: {} };
}

export async function readLockfile(projectRoot: string): Promise<Lockfile | null> {
  const file = lockfilePath(projectRoot);
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return null;
  }
  return parseLockfile(raw, file);
}

function parseLockfile(raw: string, file: string): Lockfile {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new ShelfError("CONFLICT", `${file} is not valid JSON: ${error}`);
  }
  const parsed = LockfileSchema.safeParse(json);
  if (!parsed.success) {
    throw new ShelfError("CONFLICT", `${file} is invalid: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export async function ensureLockfileDir(projectRoot: string): Promise<void> {
  await mkdir(dirname(lockfilePath(projectRoot)), { recursive: true });
}

/**
 * Synchronous on purpose: it is called inside a database write transaction (which
 * cannot await) so that concurrent shelf processes serialise lockfile updates on
 * the SQLite write lock.
 */
export function writeLockfileSync(projectRoot: string, lockfile: Lockfile): void {
  const file = lockfilePath(projectRoot);
  const sorted: Lockfile = {
    ...lockfile,
    skills: Object.fromEntries(
      Object.entries(lockfile.skills).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
  const staging = `${file}.shelf-${randomUUID()}`;
  writeFileSync(staging, `${JSON.stringify(sorted, null, 2)}\n`);
  renameSync(staging, file);
}

/** Re-reads the lockfile synchronously; used inside write transactions. */
export function readLockfileSync(projectRoot: string): Lockfile | null {
  const file = lockfilePath(projectRoot);
  try {
    return parseLockfile(readFileSync(file, "utf8"), file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
