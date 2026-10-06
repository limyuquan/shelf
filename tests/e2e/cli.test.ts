import { beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Drives the real CLI as a subprocess. Set SHELF_BIN to test a compiled binary
 * (CI does); otherwise the TypeScript entry point runs under Bun.
 */
const ENTRY = resolve(import.meta.dir, "../../packages/cli/src/main.ts");
// Bun reads bunfig.toml (which enables Tailwind) from the working directory, and
// the tests run the CLI from temporary projects, so point at it explicitly.
const BUNFIG = resolve(import.meta.dir, "../../bunfig.toml");
const COMMAND = process.env.SHELF_BIN
  ? [process.env.SHELF_BIN]
  : [process.execPath, `--config=${BUNFIG}`, ENTRY];

interface Envelope {
  schemaVersion: number;
  ok: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string; hint: string | null };
}

let home: string;
let project: string;

/** Every location shelf writes to points into the temp home, never the real one. */
function isolatedEnv(): Record<string, string | undefined> {
  return {
    ...process.env,
    HOME: home,
    SHELF_HOME: join(home, ".shelf"),
    CLAUDE_CONFIG_DIR: join(home, ".claude"),
    CODEX_HOME: join(home, ".codex"),
    SHELF_ACTOR: "e2e",
  };
}

async function shelf(...args: string[]): Promise<{ exitCode: number; json: Envelope }> {
  const proc = Bun.spawn([...COMMAND, ...args, "--json"], {
    cwd: project,
    env: isolatedEnv(),
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

  test("an uninitialised project suggests nothing for agents to act on", async () => {
    const { exitCode, json } = await shelf("status");
    expect(exitCode).toBe(0);
    expect(json.data).toMatchObject({ initialized: false, actions: [] });
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

  test("restore brings back an earlier revision; show --revision prints it", async () => {
    await shelf("new", "pdf-tools", "-d", "Work with PDFs");
    const skillFile = join(home, ".shelf/library/pdf-tools/SKILL.md");
    const original = await Bun.file(skillFile).text();
    const first = (await shelf("show", "pdf-tools")).json.data?.revision as string;
    await Bun.write(skillFile, `${original}\nA later edit.\n`);

    const old = await shelf("show", "pdf-tools", "--revision", first.slice(7, 15));
    expect(old.json.data).toMatchObject({ revision: first, latest: false, files: ["SKILL.md"] });

    const { exitCode, json } = await shelf("restore", "pdf-tools", first.slice(7, 15));
    expect(exitCode).toBe(0);
    expect(json.data).toMatchObject({ skill: "pdf-tools", revision: first, restored: true });
    expect(await Bun.file(skillFile).text()).toBe(original);
    const log = await shelf("log", "pdf-tools");
    expect(log.json.data?.revisions).toHaveLength(2);
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

/** Runs a hook the way a harness does: payload on stdin, plain stdout. */
async function hook(event: string, payload: object): Promise<{ exitCode: number; stdout: string }> {
  const proc = Bun.spawn([...COMMAND, "hook", event, "--harness", "claude-code"], {
    cwd: project,
    env: isolatedEnv(),
    stdin: new Blob([JSON.stringify(payload)]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  return { exitCode, stdout };
}

describe("harness hooks", () => {
  test("setup installs them and --no-hooks removes them", async () => {
    const settings = join(home, ".claude/settings.json");
    const installed = JSON.parse(await Bun.file(settings).text());
    expect(installed.hooks.SessionStart[0].hooks[0].command).toContain(
      "hook session-start --harness claude-code",
    );
    await shelf("setup", "--no-hooks");
    expect(JSON.parse(await Bun.file(settings).text())).toEqual({});
  });

  test("using a skill renews it; session start stays silent until something is due", async () => {
    await shelf("init");
    await shelf("new", "pdf-tools", "-d", "Work with PDFs");
    await shelf("borrow", "pdf-tools", "--days", "3");

    const start = await hook("session-start", { cwd: project, source: "startup" });
    expect(start).toMatchObject({ exitCode: 0 });
    expect(start.stdout).toStartWith("shelf: due soon unless used: pdf-tools (3d)");

    const use = await hook("skill-use", {
      cwd: project,
      tool_name: "Skill",
      tool_input: { skill: "pdf-tools" },
    });
    expect(use).toEqual({ exitCode: 0, stdout: "" });
    expect((await shelf("status")).json.data?.loans).toMatchObject([
      { skill: "pdf-tools", due: "active", daysLeft: 30 },
    ]);
    expect((await hook("session-start", { cwd: project })).stdout).toBe("");
  });

  test("a hook never fails the agent's turn", async () => {
    expect(await hook("skill-use", { cwd: "/nonexistent", tool_name: "Skill" })).toEqual({
      exitCode: 0,
      stdout: "",
    });
    expect((await hook("bogus-event", {})).exitCode).toBe(0);
  });
});

describe("shelf ui", () => {
  test("serves the embedded dashboard and its API", async () => {
    const proc = Bun.spawn([...COMMAND, "ui", "--no-open", "--json"], {
      cwd: project,
      env: isolatedEnv(),
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
      // Tailwind must have run: an unprocessed build ships a dashboard without styles.
      const stylesheet = /href="([^"]+\.css)"/.exec(html)?.[1] ?? "";
      expect(await (await fetch(new URL(stylesheet, url))).text()).toContain("bg-surface");

      const api = await fetch(new URL("/api/projects", url), {
        headers: { "x-shelf-token": token },
      });
      expect(api.status).toBe(200);
      expect(await api.json()).toEqual([]);
    } finally {
      proc.kill();
    }
  });
});
