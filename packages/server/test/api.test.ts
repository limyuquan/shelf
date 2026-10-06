import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type ClientResponse, hc } from "hono/client";
import { addSkill } from "../../core/src/services/import.ts";
import { borrow } from "../../core/src/services/loans.ts";
import { initProject } from "../../core/src/services/project.ts";
import { used } from "../../core/src/services/usage.ts";
import { appendToFile, createTestEnv, setupProject } from "../../core/test/helpers.ts";
import { createApi } from "../src/app.ts";
import { type Api, TOKEN_HEADER } from "../src/contract.ts";
import { type DashboardServer, startServer } from "../src/serve.ts";
import { loadToken } from "../src/token.ts";
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
const SYSTEM = { version: "0.0.0-test", bundledSkill: "skill", hookCommand: "/bin/shelf" };
const TOKEN = "test-token";

/**
 * The API in-process, through the same typed client the web app uses: these
 * tests exercise the contract, not just the handlers.
 */
async function setup(skills: string[] = ["pdf"]) {
  const env = await createTestEnv();
  const ctx = await setupProject(env, skills);
  const app = createApi(ctx, { token: TOKEN, isAllowedHost: (host) => host === HOST }, SYSTEM);
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

describe("insights", () => {
  test("reports session cost per project and 30 days of skill use", async () => {
    const { env, ctx, client, projectId } = await setup(["pdf", "git"]);
    await borrow(ctx, ["pdf"]);
    await used(ctx, ["pdf"]);
    await mkdir(join(env.root, ".claude/skills/review"), { recursive: true });
    await writeFile(
      join(env.root, ".claude/skills/review/SKILL.md"),
      "---\nname: review\ndescription: Review code\n---\n",
    );

    const result = await ok(client.insights.$get());
    expect(result.usage.days).toHaveLength(30);
    expect(result.usage.active.at(-1)).toBe(1);
    expect(result.globalSkills).toMatchObject([
      { name: "review", harnessDirs: [".claude/skills"], bundled: false },
    ]);
    const [project] = result.projects;
    expect(project).toMatchObject({ id: projectId, globalTokens: 5 });
    expect(project?.skills).toMatchObject([{ skill: "pdf", activeDays30: 1 }]);
    expect(project?.sessionTokens).toBe(project?.skills[0]?.descriptionTokens);
    const pdf = result.skills.find((skill) => skill.name === "pdf");
    expect(pdf).toMatchObject({ borrowers: 1, activeDays30: 1, neverUsed: false });
    expect(typeof pdf?.lastUsedAt).toBe("string");
    expect(result.skills.find((skill) => skill.name === "git")?.neverUsed).toBe(true);
  });
});

describe("keep and loan length", () => {
  test("a kept loan never comes due; a skill's loan length sets new due dates", async () => {
    const { env, client, projectId } = await setup(["pdf", "git"]);
    const lengths = await ok(
      client.skills[":name"]["loan-days"].$put({ param: { name: "git" }, json: { days: 14 } }),
    );
    expect(lengths).toEqual({ skill: "git", loanDays: 14, customLoanDays: 14 });
    const tooLong = await client.skills[":name"]["loan-days"].$put({
      param: { name: "git" },
      json: { days: 365 },
    });
    expect(tooLong.status).toBe(422);

    const loans = client.projects[":id"].loans;
    const borrowed = await ok(
      loans.$post({ param: { id: projectId }, json: { skills: ["pdf", "git"], keep: true } }),
    );
    expect(borrowed.map((loan) => [loan.skill, loan.kept])).toEqual([
      ["pdf", true],
      ["git", true],
    ]);
    const param = { id: projectId, skill: "git" };
    expect(await ok(loans[":skill"].keep.$post({ param, json: { keep: false } }))).toMatchObject({
      skill: "git",
      kept: false,
      changed: true,
    });

    env.clock.advanceDays(10);
    const page = await ok(client.projects[":id"].$get({ param: { id: projectId } }));
    expect(page.report.loans.map((loan) => [loan.skill, loan.kept, loan.due])).toEqual([
      ["git", false, "due-soon"],
      ["pdf", true, "active"],
    ]);
    expect((await ok(client.attention.$get())).map((item) => item.skill)).toEqual(["git"]);
    const catalog = await ok(client.skills.$get({ query: {} }));
    expect(catalog.map((skill) => [skill.name, skill.loanDays, skill.customLoanDays])).toEqual([
      ["git", 14, 14],
      ["pdf", 30, null],
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

describe("promote and diff", () => {
  test("shows a project's edits, then promotes them and updates other borrowers", async () => {
    const { env, ctx, client, projectId } = await setup();
    await borrow(ctx, ["pdf"]);
    const other = await env.context(join(env.root, "other"));
    await mkdir(join(other.cwd, ".git"), { recursive: true });
    await initProject(other);
    await borrow(other, ["pdf"]);
    await appendToFile(join(env.projectDir, ".agents/skills/pdf/SKILL.md"), "Better guidance.");

    const loan = client.projects[":id"].loans[":skill"];
    const param = { id: projectId, skill: "pdf" };
    const diff = await ok(loan.diff.$get({ param, query: {} }));
    expect(diff.files[0]?.patch).toContain("+Better guidance.");

    const promoted = await ok(loan.promote.$post({ param, json: { propagate: true } }));
    expect(promoted.revision).not.toBe(promoted.previousRevision);
    expect(promoted.propagation?.projects).toEqual(
      expect.arrayContaining([expect.objectContaining({ project: "other", status: "updated" })]),
    );
  });
});

describe("skill files", () => {
  test("reads and saves reference files, recording a revision", async () => {
    const { env, client } = await setup();
    await mkdir(join(env.shelfHome, "library/pdf/references"));
    await writeFile(join(env.shelfHome, "library/pdf/references/tables.md"), "# Tables\n");

    const file = client.skills[":name"].file;
    const read = await ok(
      file.$get({ param: { name: "pdf" }, query: { path: "references/tables.md" } }),
    );
    expect(read).toMatchObject({ path: "references/tables.md", content: "# Tables\n" });

    await ok(
      file.$put({
        param: { name: "pdf" },
        json: { path: "references/tables.md", content: "# Tables\nUse pdfplumber.\n" },
      }),
    );
    const page = await ok(client.skills[":name"].$get({ param: { name: "pdf" } }));
    expect(page.history.revisions).toHaveLength(2);
  });

  test("refuses paths outside the skill and files that do not exist", async () => {
    const { client } = await setup();
    const file = client.skills[":name"].file;
    for (const path of ["../../config.json", "/etc/passwd", "missing.md"]) {
      const response = await file.$get({ param: { name: "pdf" }, query: { path } });
      expect(response.status).toBe(400);
    }
    const write = await file.$put({
      param: { name: "pdf" },
      json: { path: "new-file.md", content: "x" },
    });
    expect(write.status).toBe(400);
  });

  test("binary files are listed but not opened", async () => {
    const { env, client } = await setup();
    await writeFile(join(env.shelfHome, "library/pdf/logo.png"), new Uint8Array([137, 80, 0, 1]));
    const read = await ok(
      client.skills[":name"].file.$get({ param: { name: "pdf" }, query: { path: "logo.png" } }),
    );
    expect(read).toMatchObject({ content: null, size: 4 });
  });
});

describe("revisions", () => {
  /** "pdf" at v1, then v2 with a reference file. */
  async function withHistory() {
    const context = await setup();
    const { env, client } = context;
    const skill = client.skills[":name"];
    const v1 = (await ok(skill.$get({ param: { name: "pdf" } }))).detail.revision;
    await mkdir(join(env.shelfHome, "library/pdf/references"));
    await writeFile(join(env.shelfHome, "library/pdf/references/tables.md"), "# Tables\n");
    const v2 = (await ok(skill.$get({ param: { name: "pdf" } }))).detail.revision;
    return { ...context, revisions: skill.revisions[":revision"], v1, v2 };
  }
  const prefix = (hash: string, length = 8) => hash.replace("sha256:", "").slice(0, length);

  test("shows a revision by prefix or latest, and compares it", async () => {
    const { client, revisions, v1, v2 } = await withHistory();
    const old = await ok(revisions.$get({ param: { name: "pdf", revision: prefix(v1, 6) } }));
    expect(old).toMatchObject({ revision: v1, latest: false, parent: null, files: ["SKILL.md"] });
    const head = await ok(revisions.$get({ param: { name: "pdf", revision: "latest" } }));
    expect(head).toMatchObject({ revision: v2, latest: true, parent: v1 });

    const diff = await ok(
      client.skills[":name"].diff.$get({
        param: { name: "pdf" },
        query: { from: prefix(v1), to: prefix(v2) },
      }),
    );
    expect(diff.files.map((file) => file.path)).toEqual(["references/tables.md"]);

    const unknown = await revisions.$get({ param: { name: "pdf", revision: "ffffffff" } });
    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toMatchObject({
      error: { code: "INVALID_ARGUMENT", hint: expect.stringContaining("shelf log pdf") },
    });
  });

  test("reads a revision's files and refuses paths outside it", async () => {
    const { revisions, v1, v2 } = await withHistory();
    const file = revisions.file;
    const read = await ok(
      file.$get({
        param: { name: "pdf", revision: prefix(v2) },
        query: { path: "references/tables.md" },
      }),
    );
    expect(read).toMatchObject({
      path: "references/tables.md",
      content: "# Tables\n",
      revision: v2,
    });

    for (const path of ["../../config.json", "/etc/passwd", `../${prefix(v2, 64)}/SKILL.md`]) {
      const response = await file.$get({
        param: { name: "pdf", revision: prefix(v1) },
        query: { path },
      });
      expect(response.status).toBe(400);
    }
    // Present in v2 only.
    const missing = await file.$get({
      param: { name: "pdf", revision: prefix(v1) },
      query: { path: "references/tables.md" },
    });
    expect(missing.status).toBe(400);
  });

  test("restores a revision as the head and returns the skill page", async () => {
    const { ctx, client, revisions, v1, v2 } = await withHistory();
    await borrow(ctx, ["pdf"]);
    const page = await ok(
      revisions.restore.$post({ param: { name: "pdf", revision: prefix(v1) } }),
    );
    expect(page.detail).toMatchObject({ revision: v1, files: ["SKILL.md"] });
    expect(page.history.revisions.map((revision) => revision.hash)).toEqual(
      expect.arrayContaining([v1, v2]),
    );
    // The borrower stays on v2 until it updates.
    expect(page.propagation.projects).toEqual([
      expect.objectContaining({ project: "project", status: "updated" }),
    ]);
    const events = await ok(client.activity.$get({ query: { skill: "pdf" } }));
    expect(events[0]).toMatchObject({ type: "skill.revised", detail: { restoredFrom: v1 } });
  });
});

describe("pull", () => {
  test("reviews upstream changes, then applies them", async () => {
    const { env, ctx, client } = await setup([]);
    const upstream = join(env.root, "upstream", "notes");
    await mkdir(upstream, { recursive: true });
    await writeFile(join(upstream, "SKILL.md"), "---\nname: notes\ndescription: Notes\n---\nv1\n");
    await addSkill(ctx, upstream, { yes: true });
    await writeFile(join(upstream, "SKILL.md"), "---\nname: notes\ndescription: Notes\n---\nv2\n");

    const pull = client.skills[":name"].pull;
    const review = await ok(pull.$post({ param: { name: "notes" }, json: {} }));
    expect(review.status).toBe("review");
    expect(review.diff[0]?.patch).toContain("+v2");
    const applied = await ok(pull.$post({ param: { name: "notes" }, json: { yes: true } }));
    expect(applied.status).toBe("imported");
  });
});

describe("scan and adopt", () => {
  async function handCopied(dir: string, name: string, body: string): Promise<string> {
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "SKILL.md"),
      `---\nname: ${name}\ndescription: ${name}\n---\n${body}`,
    );
    return dir;
  }

  test("scans the projects' folder by default and adopts the chosen copies", async () => {
    const { env, client } = await setup(["pdf"]);
    const code = join(env.root, "code");
    for (const name of ["app", "api"]) await mkdir(join(code, name, ".git"), { recursive: true });
    const newer = await handCopied(join(code, "app/.claude/skills/review"), "review", "v2");
    const older = await handCopied(join(code, "api/.claude/skills/review"), "review", "v1");
    await cp(join(env.shelfHome, "library/pdf"), join(code, "api/.claude/skills/pdf"), {
      recursive: true,
    });

    // The only registered project sits directly in the home directory.
    const scanned = await ok(client.scan.$get({ query: {} }));
    expect(scanned).toMatchObject({ root: env.root, home: env.root });
    const groups = Object.fromEntries(scanned.report.groups.map((g) => [g.name, g]));
    expect(groups.review).toMatchObject({ copies: 2, inLibrary: false });
    expect(groups.review?.variants).toHaveLength(2);
    expect(groups.pdf?.variants[0]).toMatchObject({ isLibraryLatest: true });

    const results = await ok(
      client.adopt.$post({ json: { paths: [newer, older], unedited: true } }),
    );
    expect(results.map((r) => [r.skill, r.library, r.loan?.content])).toEqual([
      ["review", "imported", "current"],
      ["review", "older", "behind"],
    ]);

    // A root typed as `~/…` is under the home directory.
    const rescanned = await ok(client.scan.$get({ query: { root: "~/code", depth: "3" } }));
    expect(rescanned.root).toBe(code);
    const review = rescanned.report.groups.find((g) => g.name === "review");
    expect(review?.variants.flatMap((v) => v.copies.map((copy) => copy.managed))).not.toContain(
      false,
    );
  });

  test("refuses roots that are not absolute directories and bad depths or paths", async () => {
    const { env, client } = await setup();
    await writeFile(join(env.root, "notes.txt"), "not a directory");
    for (const query of [
      { root: "code" },
      { root: join(env.root, "missing") },
      { root: join(env.root, "notes.txt") },
      { depth: "0" },
      { depth: "11" },
    ]) {
      const response = await client.scan.$get({ query });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: "INVALID_ARGUMENT" } });
    }
    for (const paths of [[], ["relative/skill"]]) {
      const response = await client.adopt.$post({ json: { paths } });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: "INVALID_ARGUMENT" } });
    }
  });
});

describe("suggestions", () => {
  test("lists library skills matching the project's dependencies, minus borrowed ones", async () => {
    const { env, client, projectId } = await setup(["convex-auth", "pdf"]);
    await writeFile(
      join(env.projectDir, "package.json"),
      JSON.stringify({ dependencies: { "@convex-dev/auth": "1" } }),
    );
    const param = { id: projectId };

    const suggestions = await ok(client.projects[":id"].suggestions.$get({ param }));
    expect(suggestions).toEqual([
      {
        skill: "convex-auth",
        description: "The convex-auth skill",
        score: expect.any(Number),
        reasons: ["package.json depends on @convex-dev/auth"],
        descriptionTokens: Math.ceil("convex-authThe convex-auth skill".length / 4),
      },
    ]);

    await ok(client.projects[":id"].loans.$post({ param, json: { skills: ["convex-auth"] } }));
    expect(await ok(client.projects[":id"].suggestions.$get({ param }))).toEqual([]);
  });
});

describe("system", () => {
  test("reports hooks, config and health, and repairs what it can", async () => {
    const { env, client } = await setup();
    await mkdir(join(env.root, ".claude"));

    const report = await ok(client.system.$get());
    expect(report.version).toBe("0.0.0-test");
    expect(report.hooks.find((hook) => hook.harness === "claude-code")?.status).toBe("missing");
    expect(report.checks.find((check) => check.id === "hooks")?.status).toBe("warn");

    const repaired = await ok(client.system.repair.$post());
    expect(repaired.hooks.find((hook) => hook.harness === "claude-code")?.status).toBe("installed");
  });
});

describe("access token", () => {
  test("the token persists across restarts, owner-only, until rotated", async () => {
    const env = await createTestEnv();
    const first = await loadToken(env.shelfHome);
    expect(await loadToken(env.shelfHome)).toBe(first);
    const { mode } = await Bun.file(join(env.shelfHome, "ui-token")).stat();
    expect(mode & 0o777).toBe(0o600);
    const rotated = await loadToken(env.shelfHome, { rotate: true });
    expect(rotated).not.toBe(first);
    expect(await loadToken(env.shelfHome)).toBe(rotated);
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
    server = startServer(ctx, { page, system: SYSTEM, token: TOKEN });
    const url = new URL(server.url);
    expect(url.hostname).toBe("127.0.0.1");
    const token = url.searchParams.get("token") ?? "";

    const deepLink = await (await fetch(new URL("/library/pdf", url))).text();
    expect(deepLink).toContain('<div id="root">');
    const api = await fetch(new URL("/api/projects", url), { headers: { [TOKEN_HEADER]: token } });
    expect(api.status).toBe(200);
    // A DNS-rebinding page reaches the same socket under its own hostname.
    const rebound = await fetch(new URL("/api/projects", url), {
      headers: { [TOKEN_HEADER]: token, host: "evil.example:8445" },
    });
    expect(rebound.status).toBe(403);
  });
});

describe("search", () => {
  test("finds skills by their content, with line snippets, best first", async () => {
    const { env, client } = await setup(["pdf", "api"]);
    const api = join(env.shelfHome, "library/api");
    await appendToFile(join(api, "SKILL.md"), "\nWrap failures in an error envelope.\n");
    await mkdir(join(api, "references"));
    await writeFile(
      join(api, "references/errors.md"),
      "# Errors\n\nThe error envelope has a code.\n",
    );

    const results = await ok(client.search.$get({ query: { q: '"error envelope"' } }));
    expect(results.map((result) => result.name)).toEqual(["api"]);
    const [result] = results;
    expect(result?.matches.map((match) => [match.file, match.snippet])).toEqual([
      ["SKILL.md", "Wrap failures in an error envelope."],
      ["references/errors.md", "The error envelope has a code."],
    ]);
    expect(result?.matches[1]).toMatchObject({ line: 3, ranges: [[4, 18]] });

    const limited = await ok(client.search.$get({ query: { q: "skill", limit: "1" } }));
    expect(limited).toHaveLength(1);
    expect(await ok(client.search.$get({ query: {} }))).toEqual([]);
    const invalid = await client.search.$get({ query: { q: "x", limit: "0" } });
    expect(invalid.status).toBe(400);
  });
});

describe("live updates", () => {
  let server: DashboardServer | null = null;
  let stream: ReadableStreamDefaultReader<Uint8Array> | null = null;
  afterEach(async () => {
    await stream?.cancel().catch(() => {});
    await server?.stop();
    server = stream = null;
  });

  async function connect(skills: string[] = ["pdf"]) {
    const env = await createTestEnv();
    const ctx = await setupProject(env, skills);
    const started = startServer(ctx, { page, system: SYSTEM, token: TOKEN });
    server = started;
    const response = await fetch(new URL("/api/events", started.url), {
      headers: { [TOKEN_HEADER]: TOKEN },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    stream = reader;
    const decoder = new TextDecoder();
    let received = "";
    /** Reads until `text` arrives and returns what follows it; throws on timeout. */
    const waitFor = async (text: string, timeoutMs = 5000) => {
      const deadline = Date.now() + timeoutMs;
      while (!received.includes(text)) {
        const chunk = await Promise.race([
          reader.read(),
          Bun.sleep(Math.max(deadline - Date.now(), 0)).then(() => null),
        ]);
        if (!chunk) throw new Error(`No "${text}" within ${timeoutMs} ms; got ${received}`);
        if (chunk.done) throw new Error(`Stream ended before "${text}"; got ${received}`);
        received += decoder.decode(chunk.value, { stream: true });
      }
      received = received.slice(received.indexOf(text) + text.length);
      return received;
    };
    const get = (path: string) =>
      fetch(new URL(path, started.url), { headers: { [TOKEN_HEADER]: TOKEN } });
    await waitFor(": connected\n\n");
    return { env, ctx, waitFor, get };
  }

  test("a write from another connection reaches the stream as a change event", async () => {
    const { env, waitFor } = await connect();
    // Another process, e.g. an agent's hook, writes through its own connection.
    const other = await env.context();
    await borrow(other, ["pdf"]);
    const rest = await waitFor("event: change\n");
    const data = rest.match(/^data: (.*)\n\n/)?.[1] ?? "";
    expect(JSON.parse(data)).toEqual({ at: expect.any(String) });
  });

  test("editing the library is a change", async () => {
    const { env, waitFor } = await connect();
    await appendToFile(join(env.shelfHome, "library", "pdf", "SKILL.md"), "\nMore.\n");
    await waitFor("event: change\n");
  });

  test("the dashboard's own writes are changes, so other tabs follow", async () => {
    const { get, waitFor } = await connect();
    const [project] = (await (await get("/api/projects")).json()) as { id: string }[];
    const response = await fetch(new URL(`/api/projects/${project?.id}/loans`, server?.url), {
      method: "POST",
      headers: { [TOKEN_HEADER]: TOKEN, "content-type": "application/json" },
      body: JSON.stringify({ skills: ["pdf"] }),
    });
    expect(response.status).toBe(200);
    await waitFor("event: change\n");
  });

  test("reading the dashboard is not a change", async () => {
    const { get, waitFor } = await connect();
    for (const path of ["/api/attention", "/api/projects", "/api/skills", "/api/activity"]) {
      expect((await get(path)).status).toBe(200);
    }
    await expect(waitFor("event: change\n", 2000)).rejects.toThrow("within");
  });

  test("detail pages are not changes either (no refetch loop)", async () => {
    const { env, get, waitFor } = await connect();
    await borrow(await env.context(), ["pdf"]);
    await waitFor("event: change\n");
    const [project] = (await (await get("/api/projects")).json()) as { id: string }[];
    const reads = [
      `/api/projects/${project?.id}`,
      `/api/projects/${project?.id}/loans/pdf/diff`,
      `/api/projects/${project?.id}/suggestions`,
      "/api/skills/pdf",
      "/api/insights",
      "/api/search?q=pdf",
      "/api/system",
    ];
    // Twice: a read that writes would answer the first round with a change.
    for (const path of [...reads, ...reads]) expect((await get(path)).status).toBe(200);
    await expect(waitFor("event: change\n", 2500)).rejects.toThrow("within");
  });

  test("the stream needs the token and this server's Host", async () => {
    const env = await createTestEnv();
    server = startServer(await setupProject(env, []), { page, system: SYSTEM, token: TOKEN });
    const url = new URL("/api/events", server.url);
    expect((await fetch(url)).status).toBe(401);
    expect((await fetch(url, { headers: { [TOKEN_HEADER]: "wrong" } })).status).toBe(401);
    const rebound = await fetch(url, { headers: { [TOKEN_HEADER]: TOKEN, host: "evil.example" } });
    expect(rebound.status).toBe(403);
  });

  test("stopping the server ends open streams", async () => {
    await connect();
    await server?.stop();
    server = null;
    const ended = await Promise.race([
      stream?.read().then(
        (chunk) => chunk.done,
        () => true,
      ),
      Bun.sleep(3000).then(() => false),
    ]);
    expect(ended).toBe(true);
  });
});
