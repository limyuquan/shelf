import { afterEach, describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { type ClientResponse, hc } from "hono/client";
import { borrow } from "../../core/src/services/loans.ts";
import { initProject } from "../../core/src/services/project.ts";
import { appendToFile, createTestEnv, setupProject } from "../../core/test/helpers.ts";
import { createApi } from "../src/app.ts";
import { type Api, TOKEN_HEADER } from "../src/contract.ts";
import { type DashboardServer, startServer } from "../src/serve.ts";
import page from "./fixture/index.html";

type Success<R> =
  R extends ClientResponse<infer Body, infer Status, "json">
    ? Status extends 200
      ? Body
      : never
    : never;

/** Asserts a 200 and returns the body, typed as the route's success response. */
async function ok<R extends ClientResponse<unknown, number, "json">>(
  request: Promise<R>,
): Promise<Success<R>> {
  const response = await request;
  expect(response.status).toBe(200);
  return (await response.json()) as Success<R>;
}

const HOST = "127.0.0.1:4100";
const TOKEN = "test-token";

/**
 * The API in-process, through the same typed client the web app uses: these
 * tests exercise the contract, not just the handlers.
 */
async function setup(skills: string[] = ["pdf"]) {
  const env = await createTestEnv();
  const ctx = await setupProject(env, skills);
  const app = createApi(ctx, { token: TOKEN, allowedHosts: () => new Set([HOST]) });
  const client = hc<Api>(`http://${HOST}`, {
    headers: { [TOKEN_HEADER]: TOKEN },
    fetch: (input: RequestInfo | URL, init?: RequestInit) => app.request(input, init),
  }).api;
  const projectId = (await (await client.projects.$get()).json())[0]?.id as string;
  return { env, ctx, app, client, projectId };
}

describe("guard", () => {
  test("rejects calls without the token", async () => {
    const { app } = await setup();
    const response = await app.request(`http://${HOST}/api/projects`);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  test("rejects a foreign Host header (DNS rebinding)", async () => {
    const { app } = await setup();
    const response = await app.request("http://evil.example/api/projects", {
      headers: { [TOKEN_HEADER]: TOKEN },
    });
    expect(response.status).toBe(403);
  });

  test("unknown routes and invalid input use the error envelope", async () => {
    const { app, client, projectId } = await setup();
    const missing = await app.request(`http://${HOST}/api/nope`, {
      headers: { [TOKEN_HEADER]: TOKEN },
    });
    expect(missing.status).toBe(404);

    const invalid = await client.projects[":id"].loans.$post({
      param: { id: projectId },
      json: { skills: [] },
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: { code: "INVALID_ARGUMENT" } });
  });
});

describe("projects and loans", () => {
  test("reading a project never expires its loans", async () => {
    const { env, ctx, client, projectId } = await setup();
    await borrow(ctx, ["pdf"], { days: 3 });
    env.clock.advanceDays(5);

    const overview = await (await client.projects.$get()).json();
    expect(overview[0]).toMatchObject({ name: "project", loans: 1, overdue: 1 });
    const project = await ok(client.projects[":id"].$get({ param: { id: projectId } }));
    expect(project.report.loans[0]).toMatchObject({ skill: "pdf", due: "overdue" });
    const again = await ok(client.projects[":id"].$get({ param: { id: projectId } }));
    expect(again.report.loans).toHaveLength(1);
  });

  test("borrow, renew, move, update and return", async () => {
    const { client, projectId } = await setup(["pdf", "git"]);
    const loans = client.projects[":id"].loans;

    const borrowed = await loans.$post({ param: { id: projectId }, json: { skills: ["pdf"] } });
    expect(await borrowed.json()).toMatchObject([{ skill: "pdf", status: "borrowed" }]);

    const param = { id: projectId, skill: "pdf" };
    expect((await loans[":skill"].renew.$post({ param, json: { reason: "in use" } })).status).toBe(
      200,
    );
    const moved = await loans[":skill"].due.$post({ param, json: { when: "2026-11-01" } });
    expect((await moved.json()) as { dueAt: string }).toMatchObject({
      dueAt: expect.stringMatching(/^2026-11-01/),
    });
    const tooFar = await loans[":skill"].due.$post({ param, json: { when: "2030-01-01" } });
    expect(tooFar.status).toBe(422);
    expect(await tooFar.json()).toMatchObject({ error: { code: "LOAN_LIMIT" } });

    const updated = await loans[":skill"].update.$post({ param, json: {} });
    expect(await updated.json()).toMatchObject({ skill: "pdf", status: "current" });
    expect((await loans[":skill"].return.$post({ param, json: {} })).status).toBe(200);

    const events = await ok(client.activity.$get({ query: { skill: "pdf" } }));
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(["loan.returned", "loan.due-changed", "loan.borrowed"]),
    );
  });

  test("attention lists loans that need action across projects", async () => {
    const { env, ctx, client } = await setup(["pdf", "git"]);
    await borrow(ctx, ["pdf", "git"]);
    await appendToFile(join(env.projectDir, ".agents/skills/git/SKILL.md"), "edit");
    env.clock.advanceDays(25);

    const items = await (await client.attention.$get()).json();
    expect(items.map((item) => [item.skill, item.reasons])).toEqual([
      ["git", ["modified", "due-soon"]],
      ["pdf", ["due-soon"]],
    ]);
  });
});

describe("library", () => {
  test("saving a skill records a revision and previews who an update reaches", async () => {
    const { env, ctx, client } = await setup();
    await borrow(ctx, ["pdf"]);
    const other = await env.context(join(env.root, "other"));
    await mkdir(join(other.cwd, ".git"), { recursive: true });
    await initProject(other);
    await borrow(other, ["pdf"]);
    await appendToFile(join(other.cwd, ".claude/skills/pdf/SKILL.md"), "local edit");

    const skill = client.skills[":name"];
    const page = await ok(skill.$get({ param: { name: "pdf" } }));
    expect(page.detail).toMatchObject({ borrowers: 2, source: null });

    const content = `${page.detail.content}\nNew guidance.\n`;
    const saved = await ok(skill.$put({ param: { name: "pdf" }, json: { content } }));
    expect(saved.history.revisions).toHaveLength(2);
    expect(
      Object.fromEntries(saved.propagation.projects.map((p) => [p.project, p.status])),
    ).toEqual({ project: "updated", other: "skipped-local-changes" });

    const result = await ok(
      skill.propagate.$post({ param: { name: "pdf" }, json: { projects: [env.projectDir] } }),
    );
    expect(result.projects).toEqual([
      expect.objectContaining({ project: "project", status: "updated" }),
    ]);
  });

  test("refuses an invalid SKILL.md", async () => {
    const { client } = await setup();
    const response = await client.skills[":name"].$put({
      param: { name: "pdf" },
      json: { content: "no frontmatter" },
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_SKILL" } });
  });

  test("the catalog filters by query", async () => {
    const { client } = await setup(["pdf", "git"]);
    const found = await ok(client.skills.$get({ query: { q: "pdf" } }));
    expect(found.map((skill) => skill.name)).toEqual(["pdf"]);
  });
});

describe("server", () => {
  let server: DashboardServer | null = null;
  afterEach(async () => {
    await server?.stop();
    server = null;
  });

  test("listens on loopback, serves the app on every path and the API under /api", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, []);
    server = startServer(ctx, { page });
    const url = new URL(server.url);
    expect(url.hostname).toBe("127.0.0.1");
    const token = url.searchParams.get("token") ?? "";

    const deepLink = await (await fetch(new URL("/library/pdf", url))).text();
    expect(deepLink).toContain('<div id="root">');
    const api = await fetch(new URL("/api/projects", url), { headers: { [TOKEN_HEADER]: token } });
    expect(api.status).toBe(200);
  });
});
