import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeContext, createContext } from "@shelf/core";
import { createApi } from "@shelf/server";
import {
  createBackend,
  READ_ONLY,
  requestKey,
  type Snapshot,
  shiftDates,
} from "./client/backend.ts";
import { checkRoutes, getRoutes, recordSnapshot } from "./snapshot.ts";

const url = (path: string) => new URL(path, "http://localhost");

describe("demo snapshot", () => {
  test("every GET route of the API has a recorder", async () => {
    const home = await mkdtemp(join(tmpdir(), "shelf-demo-routes-"));
    const ctx = await createContext({ env: { HOME: home, SHELF_HOME: join(home, ".shelf") } });
    try {
      const api = createApi(
        ctx,
        { token: "t", isAllowedHost: () => true },
        { version: "0", bundledSkill: "", hookCommand: "shelf" },
      );
      expect(() => checkRoutes(getRoutes(api))).not.toThrow();
      expect(() => checkRoutes([...getRoutes(api), "/api/new-thing"])).toThrow(/new-thing/);
    } finally {
      closeContext(ctx);
      await rm(home, { recursive: true, force: true });
    }
  });

  test("records the seeded demo, and the backend answers every recorded request", async () => {
    const snapshot = await recordSnapshot();
    expect(JSON.stringify(snapshot)).not.toContain(tmpdir());
    const backend = createBackend(snapshot, () => Date.parse(snapshot.recordedAt));
    for (const key of Object.keys(snapshot.responses)) {
      const response = backend.handle("GET", url(key.slice("GET ".length)));
      expect(response.kind === "json" && response.status).toBe(200);
    }
    expect(backend.misses).toEqual([]);
  }, 120_000);
});

describe("demo backend", () => {
  const snapshot: Snapshot = {
    recordedAt: "2026-10-01T12:00:00.000Z",
    home: "/Users/you",
    bodies: [
      [
        { id: 3, projectId: "p1", skill: "a", at: "2026-10-01T11:00:00.000Z" },
        { id: 2, projectId: "p2", skill: "b", at: "2026-09-30T11:00:00.000Z" },
        { id: 1, projectId: "p1", skill: "b", at: "2026-09-29T11:00:00.000Z" },
      ],
      [{ name: "pdf-tools", description: "Read PDFs" }],
      { root: "/Users/you/code", home: "/Users/you" },
    ],
    responses: {
      "GET /api/activity?limit=1000": [200, 0],
      "GET /api/skills": [200, 1],
      "GET /api/scan": [200, 2],
    },
    search: [
      {
        name: "pdf-tools",
        description: "Read PDFs",
        files: [{ path: "SKILL.md", lines: [{ number: 5, text: "Use pdftotext for scans" }] }],
      },
    ],
  };
  const backend = createBackend(snapshot, () => Date.parse(snapshot.recordedAt));

  test("normalises query order", () => {
    expect(requestKey(url("/api/x?b=2&a=1"))).toBe("GET /api/x?a=1&b=2");
    expect(requestKey(url("/api/x?"))).toBe("GET /api/x");
  });

  test("refuses every write with the API's error envelope", () => {
    for (const method of ["POST", "PUT", "DELETE"]) {
      expect(backend.handle(method, url("/api/projects/p1/sync"), "{}")).toEqual({
        kind: "json",
        status: 403,
        body: { error: { code: READ_ONLY.code, message: READ_ONLY.message, hint: READ_ONLY.hint } },
      });
    }
  });

  test("lints drafts and searches in place", () => {
    const lint = backend.handle(
      "POST",
      url("/api/skills/lint"),
      JSON.stringify({
        name: "x",
        content: "---\nname: x\ndescription: Use when testing\n---\nBody\n",
      }),
    );
    expect(lint.kind === "json" && lint.body).toMatchObject({ issues: [] });
    const search = backend.handle("GET", url("/api/search?q=pdftotext&limit=5"));
    expect(search.kind === "json" && search.body).toMatchObject([
      { name: "pdf-tools", matches: [{ line: 5 }] },
    ]);
  });

  test("filters the broadest recording for other activity and catalog queries", () => {
    const activity = backend.handle("GET", url("/api/activity?project=p1&skill=b"));
    expect(activity.kind === "json" && activity.body).toMatchObject([{ id: 1 }]);
    const catalog = backend.handle("GET", url("/api/skills?q=pdf"));
    expect(catalog.kind === "json" && catalog.body).toHaveLength(1);
  });

  test("scans only the demo's folder", () => {
    const scan = backend.handle("GET", url("/api/scan?root=~/code"));
    expect(scan.kind === "json" && scan.status).toBe(200);
    const elsewhere = backend.handle("GET", url("/api/scan?root=/etc"));
    expect(elsewhere.kind === "json" && elsewhere.status).toBe(400);
  });

  test("answers the live-updates stream and records misses", () => {
    expect(backend.handle("GET", url("/api/events"))).toEqual({ kind: "events" });
    const miss = backend.handle("GET", url("/api/projects/nope"));
    expect(miss.kind === "json" && miss.status).toBe(404);
    expect(backend.misses).toEqual(["GET /api/projects/nope"]);
  });

  test("shifts dates by the time since recording", () => {
    const recorded = Date.parse("2026-10-01T12:00:00.000Z");
    const later = recorded + 3 * 24 * 60 * 60 * 1000 + 60_000;
    expect(
      shiftDates(
        { at: "2026-10-01T11:00:00.000Z", day: "2026-10-01", note: "2026-10-01 is a date" },
        recorded,
        later,
      ),
    ).toEqual({ at: "2026-10-04T11:01:00.000Z", day: "2026-10-04", note: "2026-10-01 is a date" });
  });
});
