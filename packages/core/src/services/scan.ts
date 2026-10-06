import type { Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { RevisionHash } from "../domain/types.ts";
import { ShelfError } from "../errors.ts";
import { pathExists } from "../library/fs.ts";
import { hashDirectory } from "../library/hash.ts";
import { SKILL_FILE } from "../library/skill-file.ts";
import { locateSkillCopy } from "../projection/locate.ts";
import { type Lockfile, readLockfile } from "../projection/lockfile.ts";
import { listProjects } from "../store/projects.ts";
import { findSkillByName, listRevisions } from "../store/skills.ts";
import type { Context } from "./context.ts";
import { refreshLibrary } from "./library.ts";

/**
 * Directories that never contain project skills and are expensive to walk:
 * version-control internals, dependencies, build output and caches.
 */
const SKIPPED_DIRS = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  ".pnpm-store",
  ".yarn",
  "bower_components",
  "vendor",
  "Pods",
  ".venv",
  "venv",
  "__pycache__",
  ".tox",
  ".mypy_cache",
  ".pytest_cache",
  "site-packages",
  "dist",
  "build",
  "out",
  "target",
  "coverage",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".turbo",
  ".parcel-cache",
  ".gradle",
  ".terraform",
  ".cache",
  ".npm",
  ".bun",
  ".cargo",
  ".rustup",
  ".local",
  ".Trash",
  "Library",
]);

export interface FoundCopy {
  readonly path: string;
  /** Project root and harness directory, when the copy sits in `<root>/.<harness>/skills/`. */
  readonly root: string | null;
  readonly target: string | null;
  /** True when that project's shelf lockfile already manages this copy. */
  readonly managed: boolean;
}

export interface ScanVariant {
  readonly revision: RevisionHash;
  /** Matches the library's latest revision of this skill. */
  readonly isLibraryLatest: boolean;
  /** Matches some recorded library revision (possibly an old one). */
  readonly inLibraryHistory: boolean;
  readonly copies: FoundCopy[];
}

export interface ScanGroup {
  readonly name: string;
  readonly inLibrary: boolean;
  readonly copies: number;
  /** Distinct contents found, most common first. More than one means drift. */
  readonly variants: ScanVariant[];
}

export interface ScanReport {
  readonly root: string;
  readonly groups: ScanGroup[];
}

/**
 * Finds every skill copy under `dir` and groups them by name and content, so
 * duplicated and drifted skills can be adopted into the library.
 */
export async function scan(
  ctx: Context,
  dir: string,
  options: { maxDepth?: number } = {},
): Promise<ScanReport> {
  const root = resolve(ctx.cwd, dir);
  if (!(await isDirectory(root))) {
    throw new ShelfError(
      "INVALID_ARGUMENT",
      `${root} is not a directory`,
      "Scan an existing directory, e.g. the one that holds your projects",
    );
  }
  await refreshLibrary(ctx);
  const skillDirs = await findSkillDirs(root, options.maxDepth ?? 6, new Set([ctx.paths.home]));
  const lockfiles = new Map<string, Lockfile | null>();

  const byName = new Map<string, Map<RevisionHash, FoundCopy[]>>();
  for (const path of skillDirs) {
    const location = locateSkillCopy(path);
    const name = location?.name ?? basename(path);
    let managed = false;
    if (location) {
      if (!lockfiles.has(location.root)) {
        lockfiles.set(location.root, await readLockfile(location.root).catch(() => null));
      }
      const locked = lockfiles.get(location.root)?.skills[name];
      managed = Boolean(locked?.targets.includes(location.target));
    }
    const revision = await hashDirectory(path);
    const variants = byName.get(name) ?? new Map<RevisionHash, FoundCopy[]>();
    const copies = variants.get(revision) ?? [];
    copies.push({ path, root: location?.root ?? null, target: location?.target ?? null, managed });
    variants.set(revision, copies);
    byName.set(name, variants);
  }

  const groups: ScanGroup[] = [...byName].map(([name, variants]) => {
    const skill = findSkillByName(ctx.db, name);
    const history = new Set(skill ? listRevisions(ctx.db, skill.id).map((rev) => rev.hash) : []);
    const sorted = [...variants]
      .map(([revision, copies]) => ({
        revision,
        isLibraryLatest: skill?.latestRevision === revision,
        inLibraryHistory: history.has(revision),
        copies,
      }))
      .sort((a, b) => b.copies.length - a.copies.length);
    return {
      name,
      inLibrary: Boolean(skill && !skill.archivedAt),
      copies: sorted.reduce((total, variant) => total + variant.copies.length, 0),
      variants: sorted,
    };
  });
  groups.sort((a, b) => b.copies - a.copies || a.name.localeCompare(b.name));
  return { root, groups };
}

async function findSkillDirs(dir: string, depth: number, excluded: Set<string>): Promise<string[]> {
  if (depth < 0 || excluded.has(dir)) return [];
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return []; // unreadable directories are skipped, not fatal
  }
  const found: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || SKIPPED_DIRS.has(entry.name)) continue;
    const child = join(dir, entry.name);
    if (entry.name === "skills") {
      for (const skill of await readdir(child, { withFileTypes: true }).catch(() => [])) {
        const skillDir = join(child, skill.name);
        if (skill.isDirectory() && (await pathExists(join(skillDir, SKILL_FILE))))
          found.push(skillDir);
      }
      continue;
    }
    found.push(...(await findSkillDirs(child, depth - 1, excluded)));
  }
  return found;
}

/**
 * Where to look for existing skills when the user hasn't said: the deepest
 * directory holding every registered project's parent (`~/code` for `~/code/a`
 * and `~/code/b`). When that is the home directory or above it (projects spread
 * over `~/code` and `~/work`), it is the home's direct child holding the most
 * projects instead. Without projects, it is the home directory.
 */
export async function defaultScanRoot(ctx: Context): Promise<string> {
  const home = resolve(ctx.paths.userHome);
  const parents = listProjects(ctx.db).map((project) => dirname(resolve(project.path)));
  const [first] = parents;
  if (first === undefined) return home;

  let common = first;
  while (!parents.every((parent) => isWithin(common, parent))) {
    const up = dirname(common);
    if (up === common) break;
    common = up;
  }
  if (isWithin(common, home)) common = busiestHomeChild(home, parents) ?? home;
  return (await isDirectory(common)) ? common : home;
}

/** The direct child of `home` that holds the most of `dirs` (ties: alphabetical). */
function busiestHomeChild(home: string, dirs: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const dir of dirs) {
    if (dir === home || !isWithin(home, dir)) continue;
    const child = relative(home, dir).split(sep)[0] as string;
    counts.set(child, (counts.get(child) ?? 0) + 1);
  }
  const [best] = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return best ? join(home, best[0]) : null;
}

/** Whether `path` is `dir` or inside it. */
function isWithin(dir: string, path: string): boolean {
  const rel = relative(dir, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

async function isDirectory(path: string): Promise<boolean> {
  return (await stat(path).catch(() => null))?.isDirectory() ?? false;
}
