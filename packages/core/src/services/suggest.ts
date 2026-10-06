import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Project } from "../domain/types.ts";
import { listActiveLoans } from "../store/loans.ts";
import { listSkills } from "../store/skills.ts";
import type { Context } from "./context.ts";
import { estimateTokens } from "./insights.ts";
import { refreshLibrary } from "./library.ts";
import { requireProject } from "./project.ts";

/**
 * Skill suggestions from what a project is built with. Signals come from a few
 * cheap, bounded reads (dependency manifests and well-known files at the project
 * root, its direct subdirectories and common workspace folders) and are matched
 * against library skill names and descriptions as words. No network, no deep scan:
 * a hint for the user, never a reason for an agent to borrow more than a task needs.
 */

export interface ProjectSignal {
  /** Lower-case word or package name matched against skills. */
  readonly term: string;
  /** Where it was found, relative to the project root, e.g. `package.json` or `convex/`. */
  readonly source: string;
  /** In words, e.g. "package.json depends on @playwright/test" or "has convex/". */
  readonly reason: string;
  /**
   * Matched against skill names only. Used for loose terms (the `drizzle` of
   * `drizzle-orm`, the `go` of go.mod) that would be noise as description words.
   */
  readonly nameOnly: boolean;
}

export interface Suggestion {
  readonly skill: string;
  readonly description: string;
  readonly score: number;
  /** Why it is suggested, e.g. "package.json depends on convex". At most three. */
  readonly reasons: string[];
  /** What borrowing it adds to every session: its name and description (as insights). */
  readonly descriptionTokens: number;
}

export interface SuggestOptions {
  /** Most suggestions returned (default 8). */
  readonly limit?: number;
}

/** A term naming a token of the skill's name, e.g. `convex` for `convex-auth`. */
const NAME_MATCH = 10;
/** A term appearing as a whole word in the description. */
const DESCRIPTION_MATCH = 3;
/** Any single match qualifies; scores only rank. */
const MIN_SCORE = DESCRIPTION_MATCH;
const MAX_REASONS = 3;

/**
 * Terms too common to say anything about a project: nearly every JavaScript
 * project has them, or they are generic words left over from package names.
 * `jest`, `react`, `vite` and the like stay: a skill about them is specific.
 */
const STOPLIST = new Set([
  "typescript",
  "eslint",
  "prettier",
  "types",
  "node",
  "react-dom",
  "tslib",
  "biome",
  "babel",
  "nodemon",
  "rimraf",
  "concurrently",
  "cross-env",
  "dotenv",
  "pip",
  "setuptools",
  "wheel",
  "black",
  "ruff",
  "mypy",
  // Leftovers from scopes and package names (`@scope/core`, `foo-cli`, `x-utils`).
  "app",
  "cli",
  "core",
  "config",
  "dev",
  "lib",
  "plugin",
  "test",
  "tests",
  "utils",
  "api",
  "sdk",
  "js",
]);

/** Folders whose children are packages of a monorepo, also searched for signals. */
const WORKSPACE_DIRS = new Set(["packages", "apps", "services", "libs", "crates", "modules"]);
const SKIPPED_DIRS = new Set([
  "node_modules",
  "vendor",
  "target",
  "dist",
  "build",
  "out",
  "coverage",
  "venv",
  "env",
  "__pycache__",
]);
/** Directories inspected per project, so a huge repository stays cheap. */
const MAX_DIRS = 64;
/** Manifests larger than this are skipped: real ones are far smaller. */
const MAX_MANIFEST_BYTES = 512 * 1024;

/** Library skills the project might want, best first. Read-only apart from library reconciliation. */
export async function suggestSkills(
  ctx: Context,
  project: Project,
  { limit = 8 }: SuggestOptions = {},
): Promise<Suggestion[]> {
  await refreshLibrary(ctx);
  const signals = await projectSignals(project.path);
  const borrowed = new Set(listActiveLoans(ctx.db, project.id).map((loan) => loan.skillName));
  const byTerm = groupByTerm(signals);

  const suggestions: Suggestion[] = [];
  for (const skill of listSkills(ctx.db)) {
    if (borrowed.has(skill.name)) continue;
    const nameTokens = tokens(skill.name);
    const description = skill.description.toLowerCase();
    let score = 0;
    const reasons: string[] = [];
    for (const [term, termSignals] of byTerm) {
      const nameMatch = containsRun(nameTokens, tokens(term));
      const descriptionMatch =
        !nameMatch && termSignals.some((s) => !s.nameOnly) && mentions(description, term);
      if (!nameMatch && !descriptionMatch) continue;
      score += nameMatch ? NAME_MATCH : DESCRIPTION_MATCH;
      for (const signal of termSignals) {
        if (!reasons.includes(signal.reason)) reasons.push(signal.reason);
      }
    }
    if (score < MIN_SCORE) continue;
    suggestions.push({
      skill: skill.name,
      description: skill.description,
      score,
      reasons: reasons.slice(0, MAX_REASONS),
      descriptionTokens: estimateTokens(skill.name + skill.description),
    });
  }
  return suggestions
    .sort((a, b) => b.score - a.score || a.skill.localeCompare(b.skill))
    .slice(0, limit);
}

export interface ProjectSuggestions {
  readonly project: Project;
  readonly suggestions: Suggestion[];
}

/** Suggestions for the project containing `ctx.cwd`; `NOT_INITIALIZED` outside one. */
export async function suggestHere(
  ctx: Context,
  options: SuggestOptions = {},
): Promise<ProjectSuggestions> {
  const { project } = await requireProject(ctx);
  return { project, suggestions: await suggestSkills(ctx, project, options) };
}

/**
 * What a project is built with: dependency names from its manifests and
 * well-known files and folders, from the root and one level of packages below it.
 */
export async function projectSignals(root: string): Promise<ProjectSignal[]> {
  // Dependencies first, so a skill's reasons lead with the most specific one.
  const dependencies: ProjectSignal[] = [];
  const markers: ProjectSignal[] = [];
  for (const dir of await signalDirs(root)) {
    const at = (name: string) => (dir ? `${dir}/${name}` : name);
    for (const entry of await listDir(join(root, dir))) {
      if (entry.isFile()) {
        const names = await manifestDependencies(entry.name, join(root, dir, entry.name));
        for (const name of names ?? []) dependencies.push(...dependencyTerms(name, at(entry.name)));
      }
      for (const marker of markersFor(entry.name, entry.isDirectory())) {
        const relative = marker.requires ? `${entry.name}/${marker.requires}` : entry.name;
        const found = await stat(join(root, dir, relative)).catch(() => null);
        if (!found) continue;
        const source = at(relative) + (found.isDirectory() ? "/" : "");
        markers.push({
          term: marker.term,
          source,
          reason: `has ${source}`,
          nameOnly: marker.nameOnly ?? false,
        });
      }
    }
  }
  return [...dependencies, ...markers].filter(
    (signal) => signal.term.length >= 2 && !STOPLIST.has(signal.term),
  );
}

/** The root (as ""), its direct subdirectories, and the packages of workspace folders. */
async function signalDirs(root: string): Promise<string[]> {
  const dirs = [""];
  const children = (await listDir(root)).filter(isSearchable).map((entry) => entry.name);
  dirs.push(...children);
  for (const child of children.filter((name) => WORKSPACE_DIRS.has(name))) {
    const packages = (await listDir(join(root, child))).filter(isSearchable);
    dirs.push(...packages.map((entry) => `${child}/${entry.name}`));
  }
  return dirs.slice(0, MAX_DIRS);
}

type Entry = Awaited<ReturnType<typeof listDir>>[number];

const isSearchable = (entry: Entry) =>
  entry.isDirectory() && !entry.name.startsWith(".") && !SKIPPED_DIRS.has(entry.name);

async function listDir(dir: string) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

interface Marker {
  readonly term: string;
  /** What must exist inside the directory, e.g. `schema.prisma` in `prisma/`. */
  readonly requires?: string;
  readonly nameOnly?: boolean;
}

/** Well-known files and folders, and the term each one implies. */
function markersFor(name: string, isDirectory: boolean): Marker[] {
  if (isDirectory) {
    switch (name) {
      case "convex":
        return [{ term: "convex" }];
      case "migrations":
        return [{ term: "migrations" }];
      case "supabase":
        return [{ term: "supabase" }];
      case "prisma":
        return [{ term: "prisma", requires: "schema.prisma" }];
      case ".github":
        return [{ term: "github-actions", requires: "workflows" }];
      default:
        return [];
    }
  }
  const config = /^([a-z]+)\.config\.[cm]?[jt]s$/.exec(name)?.[1];
  if (config && ["playwright", "next", "tailwind", "vite", "vitest", "drizzle"].includes(config)) {
    return [{ term: config }];
  }
  if (name === "Dockerfile" || /^(docker-)?compose\.ya?ml$/.test(name)) return [{ term: "docker" }];
  if (name === "Cargo.toml") return [{ term: "rust" }];
  if (name === "pyproject.toml" || /^requirements.*\.txt$/.test(name)) {
    return [{ term: "python" }];
  }
  if (name === "go.mod") return [{ term: "go", nameOnly: true }];
  return [];
}

/** Dependency names declared by a manifest, or null if `file` is not one. */
async function manifestDependencies(file: string, path: string): Promise<string[] | null> {
  const parse = manifestParser(file);
  if (!parse) return null;
  const size = (await stat(path).catch(() => null))?.size ?? Infinity;
  if (size > MAX_MANIFEST_BYTES) return [];
  try {
    return parse(await readFile(path, "utf8"));
  } catch {
    return []; // A broken manifest is the project's business, not a reason to fail.
  }
}

function manifestParser(file: string): ((text: string) => string[]) | null {
  if (file === "package.json") return packageJsonDependencies;
  if (file === "pyproject.toml") return pyprojectDependencies;
  if (/^requirements.*\.txt$/.test(file)) return requirementsDependencies;
  if (file === "Cargo.toml") return cargoDependencies;
  if (file === "go.mod") return goModules;
  return null;
}

type Table = Record<string, unknown>;
const table = (value: unknown): Table =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Table) : {};
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

function packageJsonDependencies(text: string): string[] {
  const manifest = table(JSON.parse(text));
  return [
    ...Object.keys(table(manifest.dependencies)),
    ...Object.keys(table(manifest.devDependencies)),
  ];
}

/** PEP 621 `[project]`, PEP 735 dependency groups, and Poetry tables. */
function pyprojectDependencies(text: string): string[] {
  const doc = table(Bun.TOML.parse(text));
  const project = table(doc.project);
  const poetry = table(table(doc.tool).poetry);
  const requirements = [
    ...strings(project.dependencies),
    ...Object.values(table(project["optional-dependencies"])).flatMap(strings),
    ...Object.values(table(doc["dependency-groups"])).flatMap(strings),
  ];
  const poetryNames = [
    ...Object.keys(table(poetry.dependencies)),
    ...Object.keys(table(poetry["dev-dependencies"])),
    ...Object.values(table(poetry.group)).flatMap((group) =>
      Object.keys(table(table(group).dependencies)),
    ),
  ].filter((name) => name !== "python");
  return [...requirements.map(requirementName), ...poetryNames].filter(Boolean);
}

function requirementsDependencies(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/#.*/, "").trim())
    .filter((line) => line && !line.startsWith("-"))
    .map(requirementName)
    .filter(Boolean);
}

/** `fastapi[all]>=0.110 ; python_version > "3.9"` → `fastapi`. */
const requirementName = (requirement: string): string =>
  /^[A-Za-z0-9][A-Za-z0-9._-]*/.exec(requirement.trim())?.[0] ?? "";

function cargoDependencies(text: string): string[] {
  const doc = table(Bun.TOML.parse(text));
  return [
    doc.dependencies,
    doc["dev-dependencies"],
    doc["build-dependencies"],
    table(doc.workspace).dependencies,
  ].flatMap((deps) => Object.keys(table(deps)));
}

/** Module paths from `require` lines and blocks. */
function goModules(text: string): string[] {
  const modules: string[] = [];
  let inBlock = false;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\/\/.*/, "").trim();
    if (inBlock) {
      if (line === ")") inBlock = false;
      else if (line) modules.push(line.split(/\s+/)[0] ?? "");
    } else if (line === "require (") {
      inBlock = true;
    } else if (line.startsWith("require ")) {
      modules.push(line.split(/\s+/)[1] ?? "");
    }
  }
  return modules.filter(Boolean);
}

/**
 * Terms for one dependency: its full name, plus the name a skill would use for
 * it: the scope (`@playwright/test` → `playwright`, `@convex-dev/auth` → `convex`),
 * a Go module's last path element (`github.com/jackc/pgx/v5` → `pgx`), or, for
 * names only, the first word (`drizzle-orm` → `drizzle`).
 */
function dependencyTerms(name: string, source: string): ProjectSignal[] {
  const full = name.toLowerCase();
  // Type declarations follow the package itself; a stoplisted name (`react-dom`)
  // must not come back through its scope or first word.
  if (full.startsWith("@types/") || STOPLIST.has(full)) return [];
  const reason = `${source} depends on ${name}`;
  const signal = (term: string, nameOnly = false): ProjectSignal => ({
    term,
    source,
    reason,
    nameOnly,
  });
  const signals = [signal(full)];
  const scope = /^@([^/]+)\//.exec(full)?.[1];
  if (scope) {
    signals.push(signal(scope.replace(/(-dev|-js|js|-io|-hq|hq)$/, "") || scope));
  } else if (full.includes("/")) {
    const parts = full.split("/").filter((part) => !/^v\d+$/.test(part));
    const last = parts[parts.length - 1];
    if (last) signals.push(signal(last));
  } else {
    const first = full.split(/[-_.]/)[0];
    if (first && first !== full && first.length >= 3) signals.push(signal(first, true));
  }
  return signals;
}

function groupByTerm(signals: readonly ProjectSignal[]): Map<string, ProjectSignal[]> {
  const byTerm = new Map<string, ProjectSignal[]>();
  for (const signal of signals) {
    const existing = byTerm.get(signal.term);
    if (existing) existing.push(signal);
    else byTerm.set(signal.term, [signal]);
  }
  return byTerm;
}

const tokens = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Whether `run` appears as consecutive tokens of `name` (`react-query` in `tanstack-react-query`). */
function containsRun(name: readonly string[], run: readonly string[]): boolean {
  if (run.length === 0 || run.length > name.length) return false;
  for (let start = 0; start + run.length <= name.length; start++) {
    if (run.every((token, offset) => name[start + offset] === token)) return true;
  }
  return false;
}

/** Whether the term appears as a whole word or phrase (`github-actions` ≈ "GitHub Actions"). */
function mentions(description: string, term: string): boolean {
  const words = tokens(term).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (words.length === 0) return false;
  return new RegExp(`(?<![a-z0-9])${words.join("[\\s._/-]+")}(?![a-z0-9])`).test(description);
}
