/**
 * The read-only demo's backend: answers the dashboard's API requests from a
 * snapshot recorded at build time (scripts/site/demo/snapshot.ts). Runs in the
 * browser (client/install.ts) and in the build's checks, so it must stay free
 * of Node APIs and of anything heavier than the two pure core modules below.
 */
import { parse as parseYaml } from "yaml";
import { type LintResult, lintSkill } from "../../../../packages/core/src/library/lint.ts";
import {
  type SearchableSkill,
  searchSkills,
} from "../../../../packages/core/src/library/text-search.ts";

export interface Snapshot {
  /** When the data was recorded (ISO). Dates are shifted by the time since, so "3 days ago" stays true. */
  readonly recordedAt: string;
  /** Distinct response bodies, referenced by index. */
  readonly bodies: unknown[];
  /** `GET <normalised path>` → `[status, body index]`. */
  readonly responses: Record<string, readonly [number, number]>;
  /** Every library skill's text, for searching in the browser with core's own ranking. */
  readonly search: SearchableSkill[];
  /** The demo's home directory, for scan roots typed as `~/…`. */
  readonly home: string;
}

export type DemoResponse =
  | { readonly kind: "json"; readonly status: number; readonly body: unknown }
  /** The live-updates stream: connected, then silent. */
  | { readonly kind: "events" };

export const READ_ONLY = {
  code: "NOT_ALLOWED",
  message: "This is a read-only demo",
  hint: "Install shelf to try it with your own skills.",
} as const;

/** Paths the backend answers without a recorded response. */
export const COMPUTED_PATHS = ["/api/events", "/api/search", "/api/skills/lint"] as const;

/** The most activity events the snapshot keeps; other activity requests are filtered from these. */
export const ACTIVITY_MAX = 1000;
const ACTIVITY_DEFAULT = 100;
const DAY = 24 * 60 * 60 * 1000;

/** `/api/x?b=2&a=1` → `/api/x?a=1&b=2`, so equivalent URLs share one snapshot key. */
export function requestKey(url: URL): string {
  const params = new URLSearchParams(url.search);
  params.sort();
  const query = params.toString();
  return `GET ${url.pathname}${query ? `?${query}` : ""}`;
}

const error = (status: number, code: string, message: string, hint: string | null = null) =>
  ({ kind: "json", status, body: { error: { code, message, hint } } }) as const;

export interface DemoBackend {
  handle(method: string, url: URL, body?: string): DemoResponse;
  /** GET requests the snapshot could not answer, for the build's checks. */
  readonly misses: string[];
}

export function createBackend(snapshot: Snapshot, now: () => number = Date.now): DemoBackend {
  const misses: string[] = [];
  const recorded = (key: string) => {
    const entry = snapshot.responses[key];
    return entry ? { status: entry[0], body: snapshot.bodies[entry[1]] } : null;
  };
  const json = (status: number, body: unknown): DemoResponse => ({
    kind: "json",
    status,
    body: shiftDates(body, Date.parse(snapshot.recordedAt), now()),
  });

  function get(url: URL): DemoResponse {
    const { pathname: path, searchParams: query } = url;
    if (path === "/api/events") return { kind: "events" };
    const hit = recorded(requestKey(url));
    if (hit) return json(hit.status, hit.body);

    if (path === "/api/search") {
      const limit = Number(query.get("limit")) || undefined;
      return json(200, searchSkills(snapshot.search, query.get("q") ?? "", limit ? { limit } : {}));
    }
    if (path === "/api/activity") {
      const all = recorded(`GET /api/activity?limit=${ACTIVITY_MAX}`);
      if (all) {
        const project = query.get("project");
        const skill = query.get("skill");
        const events = (all.body as { projectId: string | null; skill: string | null }[])
          .filter(
            (event) =>
              (!project || event.projectId === project) && (!skill || event.skill === skill),
          )
          .slice(0, Number(query.get("limit")) || ACTIVITY_DEFAULT);
        return json(200, events);
      }
    }
    if (path === "/api/skills" && query.has("q")) {
      const all = recorded("GET /api/skills");
      if (all) {
        const terms = (query.get("q") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
        return json(
          200,
          (all.body as { name: string; description: string }[]).filter((skill) =>
            terms.every((term) =>
              `${skill.name} ${skill.description}`.toLowerCase().includes(term),
            ),
          ),
        );
      }
    }
    if (path === "/api/scan") {
      // Only the demo's own projects folder exists here, at any depth.
      const fallback = recorded(`GET /api/scan`);
      const root = query
        .get("root")
        ?.replace(/^~(?=\/|$)/, snapshot.home)
        .replace(/\/+$/, "");
      const depth = query.get("depth");
      const atDepth = depth ? recorded(`GET /api/scan?depth=${depth}`) : fallback;
      const defaultRoot = (fallback?.body as { root?: string } | undefined)?.root;
      if (!root || root === defaultRoot) {
        if (atDepth) return json(atDepth.status, atDepth.body);
      } else {
        return error(
          400,
          "INVALID_ARGUMENT",
          `The demo has no folder ${query.get("root")}`,
          `Scan ${defaultRoot?.replace(snapshot.home, "~")} instead, or install shelf to scan your own.`,
        );
      }
    }
    misses.push(requestKey(url));
    return error(404, "NOT_FOUND", "This page is not part of the demo", READ_ONLY.hint);
  }

  return {
    misses,
    handle(method, url, body) {
      if (method === "GET" || method === "HEAD") return get(url);
      // Linting a draft changes nothing, so the editor's lint strip works as you type.
      if (method === "POST" && url.pathname === "/api/skills/lint") {
        const draft = JSON.parse(body ?? "{}") as { name?: string; content?: string };
        return json(200, lint(draft.content ?? "", draft.name));
      }
      return error(403, READ_ONLY.code, READ_ONLY.message, READ_ONLY.hint);
    },
  };
}

/**
 * Core's linter parses frontmatter with `Bun.YAML`. Browsers have no `Bun`, so
 * lend it one for the call, which is synchronous: no other code can see it.
 */
export function lint(content: string, name?: string): LintResult {
  const scope = globalThis as { Bun?: unknown };
  if (scope.Bun) return lintSkill(content, name);
  scope.Bun = { YAML: { parse: parseYaml } };
  try {
    return lintSkill(content, name);
  } finally {
    delete scope.Bun;
  }
}

const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Moves every timestamp (and UTC day) forward by the time since recording, so
 * relative times, due dates and usage charts look as they did when recorded.
 */
export function shiftDates(value: unknown, recordedAt: number, now: number): unknown {
  const elapsed = Math.max(0, now - recordedAt);
  if (elapsed === 0) return value;
  const days = Math.floor(now / DAY) - Math.floor(recordedAt / DAY);
  const walk = (node: unknown): unknown => {
    if (typeof node === "string") {
      if (DATE_TIME.test(node)) return new Date(Date.parse(node) + elapsed).toISOString();
      if (DATE.test(node) && days > 0) {
        return new Date(Date.parse(`${node}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
      }
      return node;
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, walk(child)]));
    }
    return node;
  };
  return walk(value);
}
