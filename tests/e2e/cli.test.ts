import { beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Drives the real CLI as a subprocess. Set SHELF_BIN to test a compiled binary
 * (CI does); otherwise the TypeScript entry point runs under Bun.
 */
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
  const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  return { exitCode, json: JSON.parse(stdout) as Envelope };
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
