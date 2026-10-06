import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ShelfError } from "../errors.ts";
import { pathExists, removeDirectory } from "./fs.ts";
import { SKILL_FILE } from "./skill-file.ts";

/** Where `shelf add` reads skills from: a git repository or a local directory. */
export type SkillSourceSpec =
  | {
      readonly kind: "git";
      readonly url: string;
      readonly ref: string | null;
      readonly path: string | null;
    }
  | { readonly kind: "local"; readonly dir: string; readonly path: string | null };

const GITHUB_SHORTHAND = /^gh:([\w.-]+)\/([\w.-]+)(?:\/([^@]+))?(?:@(.+))?$/;
const GITHUB_TREE_URL = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/tree\/([^/]+)(?:\/(.+))?$/;
const GIT_URL = /^(https?:\/\/|ssh:\/\/|git@|file:\/\/)/;

/**
 * Accepts `gh:owner/repo[/path][@ref]`, a GitHub `/tree/<ref>/<path>` URL, any
 * git URL, or a local directory. Explicit `ref`/`path` options win.
 */
export function parseSource(
  input: string,
  options: { ref?: string; path?: string; cwd: string },
): SkillSourceSpec {
  const shorthand = GITHUB_SHORTHAND.exec(input);
  if (shorthand) {
    const [, owner, repo, path, ref] = shorthand;
    return {
      kind: "git",
      url: `https://github.com/${owner}/${repo}.git`,
      ref: options.ref ?? ref ?? null,
      path: options.path ?? path ?? null,
    };
  }
  const tree = GITHUB_TREE_URL.exec(input);
  if (tree) {
    const [, owner, repo, ref, path] = tree;
    return {
      kind: "git",
      url: `https://github.com/${owner}/${repo}.git`,
      ref: options.ref ?? ref ?? null,
      path: options.path ?? path ?? null,
    };
  }
  if (GIT_URL.test(input)) {
    return { kind: "git", url: input, ref: options.ref ?? null, path: options.path ?? null };
  }
  return { kind: "local", dir: resolve(options.cwd, input), path: options.path ?? null };
}

export interface FetchedSource {
  /** Root of the fetched tree (the `path` option is not yet applied). */
  readonly root: string;
  readonly commit: string | null;
  cleanup(): Promise<void>;
}

/** Shallow-clones a git source into a temp dir, or uses a local directory in place. */
export async function fetchSource(spec: SkillSourceSpec): Promise<FetchedSource> {
  if (spec.kind === "local") {
    if (!(await pathExists(spec.dir))) {
      throw new ShelfError("INVALID_ARGUMENT", `${spec.dir} does not exist`);
    }
    return { root: spec.dir, commit: null, cleanup: async () => {} };
  }
  const root = await mkdtemp(join(tmpdir(), "shelf-source-"));
  const cleanup = () => removeDirectory(root);
  try {
    const shallow = await git([
      "clone",
      "--quiet",
      "--depth",
      "1",
      ...(spec.ref ? ["--branch", spec.ref] : []),
      spec.url,
      root,
    ]);
    if (!shallow.ok) {
      if (!spec.ref)
        throw new ShelfError("INVALID_ARGUMENT", `git clone ${spec.url} failed: ${shallow.stderr}`);
      // `--branch` accepts branches and tags only; a commit needs a full clone.
      await removeDirectory(root);
      const full = await git(["clone", "--quiet", spec.url, root]);
      const checkout = full.ok ? await git(["-C", root, "checkout", "--quiet", spec.ref]) : full;
      if (!checkout.ok) {
        throw new ShelfError(
          "INVALID_ARGUMENT",
          `Could not fetch ${spec.url} at ${spec.ref}: ${checkout.stderr}`,
        );
      }
    }
    const head = await git(["-C", root, "rev-parse", "HEAD"]);
    return { root, commit: head.ok ? head.stdout.trim() : null, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

/** Skill directories inside `dir`: itself if it has a SKILL.md, else any found below. */
export async function findSkillDirectories(dir: string, depth = 4): Promise<string[]> {
  if (await pathExists(join(dir, SKILL_FILE))) return [dir];
  if (depth === 0) return [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const found: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === ".git" || entry.name === "node_modules") continue;
    found.push(...(await findSkillDirectories(join(dir, entry.name), depth - 1)));
  }
  return found.sort();
}

async function git(args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  let proc: Bun.Subprocess<"ignore", "pipe", "pipe">;
  try {
    proc = Bun.spawn(["git", ...args], {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      // Never prompt for credentials: shelf commands are non-interactive.
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
  } catch {
    throw new ShelfError("INVALID_ARGUMENT", "git is required to add skills from a repository");
  }
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { ok: code === 0, stdout, stderr: stderr.trim() };
}
