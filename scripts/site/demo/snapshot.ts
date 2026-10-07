/**
 * Records the read-only demo's data: seeds the demo shelf (scripts/demo/seed.ts),
 * runs the real API in-process and stores its response to every GET request the
 * dashboard can make, for every project, loan, skill, revision and file.
 *
 * The request list is derived from the API's own routes: every GET route must
 * have an entry in `ROUTES`, so a new endpoint fails the build (and the test in
 * demo.test.ts) until the demo knows how to record it.
 */
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeContext, createContext, searchableSkills, searchSkills } from "@shelf/core";
import { createApi, TOKEN_HEADER } from "@shelf/server";
import { parse as parseYaml } from "yaml";
import pkg from "../../../packages/cli/package.json" with { type: "json" };
import { FRONTMATTER } from "../../../packages/core/src/library/skill-file.ts";
import bundledSkill from "../../../packages/skill/SKILL.md" with { type: "text" };
import type {
  ActivityEvent,
  CatalogEntry,
  ProjectOverview,
  ProjectPage,
  Revision,
  SkillPage,
} from "../../../packages/web/src/api/types.ts";
import { seedDemo } from "../../demo/seed.ts";
import { ACTIVITY_MAX, COMPUTED_PATHS, requestKey, type Snapshot } from "./client/backend.ts";

/** Where the demo's home directory appears to be. */
export const DEMO_HOME = "/Users/you";
const TOKEN = "demo";

type Get = <T>(path: string, query?: Record<string, string>) => Promise<T>;
type Recorder = (get: Get) => Promise<unknown>;

const each = async <T>(items: readonly T[], fn: (item: T) => Promise<unknown>) => {
  for (const item of items) await fn(item);
};
const projects = (get: Get) => get<ProjectOverview[]>("/api/projects");
const skills = (get: Get) => get<CatalogEntry[]>("/api/skills");
const skillPage = (get: Get, name: string) => get<SkillPage>(`/api/skills/${name}`);
const loans = async (get: Get) =>
  (
    await Promise.all(
      (
        await projects(get)
      ).map(async (project) =>
        (
          await get<ProjectPage>(`/api/projects/${project.id}`)
        ).report.loans.map((loan) => ({
          project: project.id,
          skill: loan.skill,
        })),
      ),
    )
  ).flat();
/** Every recorded revision of every skill, as the dashboard links them (hex, no `sha256:`). */
const revisions = async (get: Get) =>
  (
    await Promise.all(
      (
        await skills(get)
      ).map(async ({ name }) =>
        (
          await skillPage(get, name)
        ).history.revisions.map((revision) => ({
          name,
          revision: revision.hash.replace(/^sha256:/, ""),
        })),
      ),
    )
  ).flat();

/**
 * How to record each GET route, keyed by its path as the API declares it. The
 * queries match what the dashboard sends (see packages/web/src/features/…/queries.ts);
 * the browser backend filters the broadest recording for other variations.
 */
export const ROUTES: Record<string, Recorder | "computed"> = {
  "/api/attention": (get) => get("/api/attention"),
  "/api/projects": projects,
  "/api/projects/:id": async (get) => loans(get),
  "/api/projects/:id/suggestions": async (get) =>
    each(await projects(get), (project) => get(`/api/projects/${project.id}/suggestions`)),
  "/api/projects/:id/loans/:skill/diff": async (get) =>
    each(await loans(get), (loan) => get(`/api/projects/${loan.project}/loans/${loan.skill}/diff`)),
  "/api/skills": skills,
  "/api/skills/:name": async (get) => each(await skills(get), ({ name }) => skillPage(get, name)),
  "/api/skills/:name/file": async (get) =>
    each(await skills(get), async ({ name }) =>
      each((await skillPage(get, name)).detail.files, (path) =>
        get(`/api/skills/${name}/file`, { path }),
      ),
    ),
  /** The revision page compares a revision with any other revision or `latest`. */
  "/api/skills/:name/diff": async (get) =>
    each(await skills(get), async ({ name }) => {
      const hashes = (await skillPage(get, name)).history.revisions.map((revision) =>
        revision.hash.replace(/^sha256:/, ""),
      );
      for (const to of hashes) {
        for (const from of ["latest", ...hashes]) {
          if (from !== to) await get(`/api/skills/${name}/diff`, { from, to });
        }
      }
    }),
  "/api/skills/:name/revisions/:revision": async (get) => {
    await each(await revisions(get), ({ name, revision }) =>
      get(`/api/skills/${name}/revisions/${revision}`),
    );
    await each(await skills(get), ({ name }) => get(`/api/skills/${name}/revisions/latest`));
  },
  "/api/skills/:name/revisions/:revision/file": async (get) =>
    each(await revisions(get), async ({ name, revision }) =>
      each((await get<Revision>(`/api/skills/${name}/revisions/${revision}`)).files, (path) =>
        get(`/api/skills/${name}/revisions/${revision}/file`, { path }),
      ),
    ),
  "/api/search": "computed",
  "/api/sets": (get) => get("/api/sets"),
  "/api/activity": async (get) => {
    await get("/api/activity", { limit: "300" });
    await get<ActivityEvent[]>("/api/activity", { limit: String(ACTIVITY_MAX) });
  },
  "/api/insights": (get) => get("/api/insights"),
  "/api/system": (get) => get("/api/system"),
  "/api/events": "computed",
  "/api/scan": async (get) => {
    await get("/api/scan");
    for (let depth = 1; depth <= 10; depth++) await get("/api/scan", { depth: String(depth) });
  },
};

/** Queries whose results the browser's search must reproduce exactly (limit 5 is ⌘K's). */
const SEARCH_CHECKS = ["react", "api error", '"error envelope"', "test", "pdf", "migration", "qqq"];

const API_SYSTEM = { version: pkg.version, bundledSkill, hookCommand: "shelf" };

/** The API's GET routes, as declared (`/api/projects/:id`). */
export function getRoutes(api: { routes: readonly { method: string; path: string }[] }): string[] {
  return [...new Set(api.routes.filter((r) => r.method === "GET").map((r) => r.path))];
}

/** Fails when the API and `ROUTES` disagree, so a new endpoint can't silently miss the demo. */
export function checkRoutes(declared: readonly string[]): void {
  const missing = declared.filter((path) => !(path in ROUTES));
  const stale = Object.keys(ROUTES).filter((path) => !declared.includes(path));
  const computed = Object.entries(ROUTES)
    .filter(([, recorder]) => recorder === "computed")
    .map(([path]) => path);
  const unknownComputed = computed.filter(
    (path) => !(COMPUTED_PATHS as readonly string[]).includes(path),
  );
  const problems = [
    ...missing.map((path) => `GET ${path} has no recorder in scripts/site/demo/snapshot.ts`),
    ...stale.map((path) => `ROUTES lists ${path}, which the API no longer has`),
    ...unknownComputed.map(
      (path) => `${path} is marked computed but the backend doesn't answer it`,
    ),
  ];
  if (problems.length > 0)
    throw new Error(`Demo snapshot out of date:\n  ${problems.join("\n  ")}`);
}

/** Seeds a demo shelf in a temporary directory and records the API's answers. */
export async function recordSnapshot(): Promise<Snapshot> {
  const dir = await mkdtemp(join(tmpdir(), "shelf-site-demo-"));
  try {
    const demo = await seedDemo(join(dir, "home"));
    const ctx = await createContext({
      actor: "user:dashboard",
      env: { ...process.env, ...demo.env },
    });
    try {
      const api = createApi(ctx, { token: TOKEN, isAllowedHost: () => true }, API_SYSTEM);
      const declared = getRoutes(api);
      checkRoutes(declared);

      const roots = [...new Set([demo.root, await realpath(demo.root)])];
      const anonymise = (text: string) =>
        roots.reduce((out, root) => out.replaceAll(root, DEMO_HOME), text);

      const recordedAt = new Date().toISOString();
      const bodies: string[] = [];
      const bodyIndex = new Map<string, number>();
      const responses: Record<string, [number, number]> = {};
      const cache = new Map<string, Promise<unknown>>();

      const get: Get = <T>(path: string, query?: Record<string, string>) => {
        const url = new URL(path, "http://127.0.0.1");
        for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
        const key = requestKey(url);
        let pending = cache.get(key);
        if (!pending) {
          pending = (async () => {
            const response = await api.fetch(
              new Request(url, { headers: { [TOKEN_HEADER]: TOKEN } }),
            );
            const text = await response.text();
            if (!response.ok) throw new Error(`${key} failed (${response.status}): ${text}`);
            const body = anonymise(text);
            let index = bodyIndex.get(body);
            if (index === undefined) {
              index = bodies.push(body) - 1;
              bodyIndex.set(body, index);
            }
            responses[key] = [response.status, index];
            return JSON.parse(text);
          })();
          cache.set(key, pending);
        }
        return pending as Promise<T>;
      };

      for (const path of declared) {
        const recorder = ROUTES[path];
        if (recorder && recorder !== "computed") await recorder(get);
      }

      // The browser lints drafts with the `yaml` package instead of Bun.YAML.
      for (const { name } of await skills(get)) {
        const frontmatter = FRONTMATTER.exec((await skillPage(get, name)).detail.content)?.[1];
        if (
          frontmatter &&
          !Bun.deepEquals(parseYaml(frontmatter), Bun.YAML.parse(frontmatter), true)
        ) {
          throw new Error(`The demo's YAML parser reads ${name}'s frontmatter differently`);
        }
      }

      const search = JSON.parse(anonymise(JSON.stringify(await searchableSkills(ctx))));
      for (const q of SEARCH_CHECKS) {
        for (const limit of [undefined, 5]) {
          const url = new URL("http://127.0.0.1/api/search");
          url.searchParams.set("q", q);
          if (limit) url.searchParams.set("limit", String(limit));
          const response = await api.fetch(
            new Request(url, { headers: { [TOKEN_HEADER]: TOKEN } }),
          );
          const expected = anonymise(await response.text());
          const actual = JSON.stringify(searchSkills(search, q, limit ? { limit } : {}));
          if (actual !== expected) {
            throw new Error(`The demo's search disagrees with the API for ${requestKey(url)}`);
          }
        }
      }
      return {
        recordedAt,
        bodies: bodies.map((body) => JSON.parse(body)),
        responses,
        search,
        home: DEMO_HOME,
      };
    } finally {
      closeContext(ctx);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
