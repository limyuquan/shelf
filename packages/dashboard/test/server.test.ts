import { afterEach, describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { borrow } from "../../core/src/services/loans.ts";
import { initProject } from "../../core/src/services/project.ts";
import { appendToFile, createTestEnv, setupProject } from "../../core/test/helpers.ts";
import { type Dashboard, startDashboard, TOKEN_HEADER } from "../src/server.ts";

let dashboard: Dashboard | null = null;
afterEach(async () => {
  await dashboard?.stop();
  dashboard = null;
});

interface Envelope {
  ok: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: assertions over arbitrary JSON
  data?: any;
  error?: { code: string; message: string };
}

async function start(skills: string[] = ["pdf"]) {
  const env = await createTestEnv();
  const ctx = await setupProject(env, skills);
  dashboard = startDashboard(ctx);
  const token = new URL(dashboard.url).searchParams.get("token") ?? "";
  const base = `http://127.0.0.1:${dashboard.port}`;
  const call = async (method: string, path: string, body?: unknown) => {
    const response = await fetch(base + path, {
      method,
      headers: { [TOKEN_HEADER]: token, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, json: (await response.json()) as Envelope };
  };
  return { env, ctx, base, token, call };
}

describe("dashboard security", () => {
  test("listens on loopback only", async () => {
    await start();
    expect(dashboard?.url).toStartWith("http://127.0.0.1:");
  });

  test("rejects API calls without the token", async () => {
    const { base } = await start();
    const response = await fetch(`${base}/api/overview`);
    expect(response.status).toBe(401);
  });

  test("rejects a foreign Host header (DNS rebinding)", async () => {
    const { base, token } = await start();
    const response = await fetch(`${base}/api/overview`, {
      headers: { [TOKEN_HEADER]: token, host: "evil.example:80" },
    });
    expect(response.status).toBe(403);
  });
});

describe("dashboard API", () => {
  test("serves the bundled app", async () => {
    const { base } = await start();
    const html = await (await fetch(`${base}/`)).text();
    expect(html).toContain('<div id="app">');
    const script = /src="([^"]+\.js)"/.exec(html)?.[1];
    expect(script).toBeDefined();
    expect((await fetch(new URL(script as string, base))).status).toBe(200);
  });

  test("overview and project pages report state without expiring anything", async () => {
    const { env, ctx, call } = await start();
    await borrow(ctx, ["pdf"], { days: 3 });
    env.clock.advanceDays(5);

    const overview = await call("GET", "/api/overview");
    expect(overview.json.data.projects[0]).toMatchObject({ name: "project", loans: 1, overdue: 1 });

    const id = overview.json.data.projects[0].id;
    const page = await call("GET", `/api/projects/${id}`);
    expect(page.json.data.report.loans[0]).toMatchObject({ skill: "pdf", due: "overdue" });
    expect(page.json.data.report.actions[0].command).toBe("shelf sync");
    // Viewing must not have returned the skill.
    expect((await call("GET", `/api/projects/${id}`)).json.data.report.loans).toHaveLength(1);
  });

  test("renews, moves due dates, borrows and returns through the API", async () => {
    const { call } = await start(["pdf", "git"]);
    const id = (await call("GET", "/api/overview")).json.data.projects[0].id;

    expect((await call("POST", `/api/projects/${id}/borrow`, { skills: ["pdf"] })).json.ok).toBe(
      true,
    );
    const renewed = await call("POST", `/api/projects/${id}/loans/pdf/renew`, { reason: "in use" });
    expect(renewed.json.ok).toBe(true);
    const moved = await call("POST", `/api/projects/${id}/loans/pdf/due`, { when: "2026-11-01" });
    expect(moved.json.data.dueAt).toStartWith("2026-11-01");

    const tooFar = await call("POST", `/api/projects/${id}/loans/pdf/due`, { when: "2030-01-01" });
    expect(tooFar).toMatchObject({ status: 422, json: { error: { code: "LOAN_LIMIT" } } });

    expect((await call("POST", `/api/projects/${id}/loans/pdf/return`, {})).json.ok).toBe(true);
    const activity = await call("GET", "/api/activity");
    const types = activity.json.data.events.map((event: { type: string }) => event.type);
    expect(types).toContain("loan.returned");
    expect(types).toContain("loan.due-changed");
  });

  test("saving a skill records a revision and offers propagation to borrowers", async () => {
    const { env, ctx, call } = await start();
    await borrow(ctx, ["pdf"]);
    const other = await env.context(join(env.root, "other"));
    await mkdir(join(other.cwd, ".git"), { recursive: true });
    await initProject(other);
    await borrow(other, ["pdf"]);
    await appendToFile(join(other.cwd, ".claude/skills/pdf/SKILL.md"), "local edit");

    const page = await call("GET", "/api/skills/pdf");
    const content = `${page.json.data.detail.content}\nNew guidance.\n`;
    const saved = await call("PUT", "/api/skills/pdf", { content });

    expect(saved.json.data.history.revisions).toHaveLength(2);
    const statuses = Object.fromEntries(
      saved.json.data.propagation.projects.map((p: { project: string; status: string }) => [
        p.project,
        p.status,
      ]),
    );
    expect(statuses).toEqual({ project: "updated", other: "skipped-local-changes" });

    const result = await call("POST", "/api/skills/pdf/propagate", { projects: [env.projectDir] });
    expect(result.json.data.projects).toEqual([
      expect.objectContaining({ project: "project", status: "updated" }),
    ]);
  });

  test("refuses to save an invalid SKILL.md", async () => {
    const { call } = await start();
    const response = await call("PUT", "/api/skills/pdf", { content: "no frontmatter" });
    expect(response).toMatchObject({ status: 400, json: { error: { code: "INVALID_SKILL" } } });
  });
});
