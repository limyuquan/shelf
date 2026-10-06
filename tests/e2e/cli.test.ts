import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Drives the real CLI as a subprocess. Set SHELF_BIN to test a compiled binary
 * (CI does); otherwise the TypeScript entry point runs under Bun.
 */
// Each test spawns real CLI processes that create a fresh SQLite database; on a
// busy disk those fsyncs alone can exceed the 5 s default.
setDefaultTimeout(60_000);

const ENTRY = resolve(import.meta.dir, "../../packages/cli/src/main.ts");
const COMMAND = process.env.SHELF_BIN ? [process.env.SHELF_BIN] : [process.execPath, ENTRY];

interface Envelope {
  schemaVersion: number;
  ok: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string; hint: string | null };
}

let home: string;
let project: string;

async function shelf(...args: string[]): Promise<{ exitCode: number; json: Envelope }> {
  const proc = Bun.spawn([...COMMAND, ...args, "--json"], {
    cwd: project,
    env: { ...process.env, HOME: home, SHELF_HOME: join(home, ".shelf"), SHELF_ACTOR: "e2e" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  try {
    return { exitCode, json: JSON.parse(stdout) as Envelope };
  } catch {
    throw new Error(`shelf ${args.join(" ")} printed no JSON (exit ${exitCode}): ${stderr}`);
  }
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "shelf-e2e-"));
  project = join(home, "project");
  await mkdir(join(project, ".git"), { recursive: true });
  await shelf("setup");
});

describe("shelf CLI", () => {
  test("setup installs the bundled skill for every harness", async () => {
    for (const dir of [".agents/skills", ".claude/skills"]) {
      expect(await Bun.file(join(home, dir, "shelf/SKILL.md")).text()).toContain("name: shelf");
    }
  });

  test("an uninitialised project suggests `shelf init`", async () => {
    const { exitCode, json } = await shelf("status");
    expect(exitCode).toBe(0);
    expect(json.data).toMatchObject({ initialized: false, actions: [{ command: "shelf init" }] });
  });

  test("borrow → status round trip with a stable envelope", async () => {
    await shelf("init");
    await shelf("new", "pdf-tools", "-d", "Work with PDFs");
    expect((await shelf("borrow", "pdf-tools", "--days", "5")).exitCode).toBe(0);

    const { json } = await shelf("status");

    expect(json).toMatchObject({ schemaVersion: 1, ok: true });
    expect(json.data?.loans).toMatchObject([
      { skill: "pdf-tools", content: "current", due: "due-soon", daysLeft: 5 },
    ]);
  });

  test("errors carry a code, a hint and a distinct exit code", async () => {
    await shelf("init");
    const { exitCode, json } = await shelf("borrow", "nope");
    expect(exitCode).toBe(4);
    expect(json).toMatchObject({ ok: false, error: { code: "SKILL_NOT_FOUND" } });
    expect(json.error?.hint).toContain("shelf catalog");
  });

  test("parallel agents borrowing into one project do not lose lockfile entries", async () => {
    await shelf("init");
    const names = Array.from({ length: 6 }, (_, index) => `skill-${index}`);
    for (const name of names) await shelf("new", name, "-d", `Skill ${name}`);

    const results = await Promise.all(names.map((name) => shelf("borrow", name)));

    expect(results.map((result) => result.exitCode)).toEqual(names.map(() => 0));
    const lockfile = await Bun.file(join(project, ".agents/shelf.lock.json")).json();
    expect(Object.keys(lockfile.skills).sort()).toEqual(names);
  });
});

describe("usage errors with --json", () => {
  test("an unknown command returns an INVALID_ARGUMENT envelope", async () => {
    const { exitCode, json } = await shelf("frobnicate");
    expect(exitCode).toBe(2);
    expect(json).toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
  });

  test("a missing argument returns an INVALID_ARGUMENT envelope", async () => {
    const { exitCode, json } = await shelf("borrow");
    expect(exitCode).toBe(2);
    expect(json.error?.message).toContain("SKILL");
  });
});

describe("shelf ui", () => {
  test("serves the embedded dashboard and its API", async () => {
    const proc = Bun.spawn([...COMMAND, "ui", "--no-open", "--json"], {
      cwd: project,
      env: { ...process.env, HOME: home, SHELF_HOME: join(home, ".shelf") },
      stdout: "pipe",
      stderr: "pipe",
    });
    try {
      const reader = proc.stdout.getReader();
      const { value } = await reader.read();
      const envelope = JSON.parse(new TextDecoder().decode(value).split("\n")[0] ?? "") as Envelope;
      const url = new URL(String(envelope.data?.url));
      const token = url.searchParams.get("token") ?? "";

      const html = await (await fetch(url)).text();
      const script = /src="([^"]+\.js)"/.exec(html)?.[1] ?? "";
      expect((await fetch(new URL(script, url))).status).toBe(200);

      const api = await fetch(new URL("/api/overview", url), {
        headers: { "x-shelf-token": token },
      });
      expect(((await api.json()) as Envelope).ok).toBe(true);
    } finally {
      proc.kill();
    }
  });
});
