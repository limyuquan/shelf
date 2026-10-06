import { describe, expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "../src/library/fs.ts";
import { readLockfile } from "../src/projection/lockfile.ts";
import { activity } from "../src/services/activity.ts";
import { doctor } from "../src/services/doctor.ts";
import { installHooks, removeHooks } from "../src/services/hooks.ts";
import { borrow } from "../src/services/loans.ts";
import { sessionNotice } from "../src/services/session.ts";
import { setup } from "../src/services/setup.ts";
import { status } from "../src/services/status.ts";
import {
  type HookPayload,
  mayUseSkill,
  recordUseFromHook,
  skillsUsedIn,
  used,
} from "../src/services/usage.ts";
import { appendToFile, createTestEnv, DAY, setupProject } from "./helpers.ts";

const day = (date: Date) => date.toISOString().slice(0, 10);

describe("renew on use", () => {
  test("a use slides the due date to a full loan period from now", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);

    env.clock.advanceDays(20);
    const [result] = await used(ctx, ["pdf"]);

    expect(result?.status).toBe("recorded");
    expect(day(result?.dueAt as Date)).toBe(day(new Date(env.clock.now().getTime() + 30 * DAY)));
    const report = await status(ctx);
    expect(report.initialized && report.loans[0]?.lastUsedAt).toEqual(env.clock.now());
  });

  test("a loan expires only after going unused for the loan period", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);

    env.clock.advanceDays(25);
    await used(ctx, ["pdf"]);
    env.clock.advanceDays(25); // 50 days after borrowing, 25 after the last use
    expect((await status(ctx)).initialized && (await status(ctx))).toMatchObject({ expired: [] });

    env.clock.advanceDays(6);
    const report = await status(ctx);
    expect(report.initialized && report.expired).toEqual(["pdf"]);
  });

  test("repeated uses are coalesced and logged once a day", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);

    await used(ctx, ["pdf"]);
    expect((await used(ctx, ["pdf"]))[0]?.status).toBe("recent");
    env.clock.advanceDays(0.1);
    expect((await used(ctx, ["pdf"]))[0]?.status).toBe("recorded");

    const events = activity(ctx).filter((event) => event.type === "loan.used");
    expect(events).toHaveLength(1);
  });

  test("naming a skill the project does not borrow is an error", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await expect(used(ctx, ["pdf"])).rejects.toMatchObject({ code: "NOT_BORROWED" });
  });
});

describe("recognising skill use in hook payloads", () => {
  const lockfile = {
    version: 1 as const,
    project: "6f1c3c1e-5b7a-4d8e-9f0a-1b2c3d4e5f60",
    skills: {
      pdf: { revision: "sha256:a", targets: [".agents/skills", ".claude/skills"] },
      "pdf-tools": { revision: "sha256:b", targets: [".agents/skills"] },
    },
  };
  const usedBy = (payload: HookPayload) => skillsUsedIn(payload, lockfile).sort();

  test.each([
    ["the Skill tool", { tool_name: "Skill", tool_input: { skill: "pdf" } }, ["pdf"]],
    [
      "reading SKILL.md",
      { tool_name: "Read", tool_input: { file_path: "/code/app/.claude/skills/pdf/SKILL.md" } },
      ["pdf"],
    ],
    [
      "a shell read",
      { tool_name: "Bash", tool_input: { command: "cat .agents/skills/pdf-tools/SKILL.md" } },
      ["pdf-tools"],
    ],
    [
      "a Windows path",
      { tool_name: "Read", tool_input: { file_path: "C:\\app\\.agents\\skills\\pdf\\ref.md" } },
      ["pdf"],
    ],
    ["a prompt invoking it", { prompt: "/pdf-tools merge these" }, ["pdf-tools"]],
    ["a Codex skill mention", { prompt: "use $pdf on this" }, ["pdf"]],
    ["an unrelated edit", { tool_name: "Edit", tool_input: { file_path: "src/pdf.ts" } }, []],
    ["another skill directory", { tool_input: { command: "ls .agents/skills/pdfx" } }, []],
  ])("%s", (_label, payload, expected) => {
    expect(usedBy(payload as HookPayload)).toEqual(expected);
  });

  test("the pre-check rejects ordinary tool calls before any state is opened", () => {
    expect(mayUseSkill({ tool_name: "Edit", tool_input: { file_path: "src/app.ts" } })).toBe(false);
    expect(mayUseSkill({ prompt: "fix the failing test" })).toBe(false);
    expect(mayUseSkill({ prompt: "/pdf" })).toBe(true);
    expect(mayUseSkill({ tool_name: "Bash", tool_input: { command: "ls .agents/skills" } })).toBe(
      true,
    );
  });

  test("hooks record uses for the project the agent is working in", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);
    await mkdir(join(env.projectDir, "src"));

    const results = await recordUseFromHook(ctx, {
      cwd: join(env.projectDir, "src"),
      tool_name: "Read",
      tool_input: { file_path: join(env.projectDir, ".agents/skills/pdf/SKILL.md") },
    });
    expect(results.map((r) => r.skill)).toEqual(["pdf"]);
    expect(await recordUseFromHook(ctx, { cwd: env.root, tool_name: "Skill" })).toEqual([]);
  });
});

describe("session-start notice", () => {
  test("is silent while nothing needs attention", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);
    expect(await sessionNotice(ctx)).toBeNull();
    expect(await sessionNotice(await env.context(env.root))).toBeNull(); // not a project
  });

  test("reports skills due soon, local edits, and returns unused skills", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf", "lint", "git"]);
    await borrow(ctx, ["pdf", "lint"]);
    await borrow(ctx, ["git"], { days: 60 });
    await appendToFile(join(env.projectDir, ".agents/skills/git/SKILL.md"), "edit");

    env.clock.advanceDays(25);
    await used(ctx, ["lint"]);
    const notice = await sessionNotice(ctx);
    expect(notice).toStartWith("shelf: due soon unless used: pdf (5d)");
    expect(notice).toContain("edited here: git");
    expect(notice).not.toContain("lint");

    env.clock.advanceDays(6);
    expect(await sessionNotice(ctx)).toContain("returned after going unused: pdf");
    expect(await pathExists(join(env.projectDir, ".agents/skills/pdf"))).toBe(false);
    expect(Object.keys((await readLockfile(env.projectDir))?.skills ?? {})).toEqual([
      "git",
      "lint",
    ]);
  });
});

describe("harness hooks", () => {
  const settingsFile = (root: string) => join(root, ".claude/settings.json");
  const readJson = async (file: string) => JSON.parse(await readFile(file, "utf8"));

  test("install keeps the user's settings and other hooks, and is idempotent", async () => {
    const env = await createTestEnv();
    const ctx = await env.context();
    await mkdir(join(env.root, ".claude"));
    const mine = { matcher: "Bash", hooks: [{ type: "command", command: "my-linter" }] };
    await writeFile(
      settingsFile(env.root),
      JSON.stringify({ model: "opus", hooks: { PostToolUse: [mine] } }),
    );

    expect((await installHooks(ctx, "/bin/shelf")).map((c) => c.status)).toEqual(["installed"]);
    const settings = await readJson(settingsFile(env.root));
    expect(settings.model).toBe("opus");
    expect(settings.hooks.PostToolUse[0]).toEqual(mine);
    expect(settings.hooks.PostToolUse[1].hooks[0].command).toBe(
      "/bin/shelf hook skill-use --harness claude-code",
    );
    expect(settings.hooks.SessionStart[0].hooks[0].command).toBe(
      "/bin/shelf hook session-start --harness claude-code",
    );
    expect((await installHooks(ctx, "/bin/shelf"))[0]?.status).toBe("unchanged");

    // A moved binary replaces the old entries instead of adding more.
    await installHooks(ctx, "/opt/my tools/shelf");
    const moved = await readJson(settingsFile(env.root));
    expect(moved.hooks.SessionStart).toHaveLength(1);
    expect(moved.hooks.SessionStart[0].hooks[0].command).toStartWith('"/opt/my tools/shelf" hook');

    await removeHooks(ctx);
    expect(await readJson(settingsFile(env.root))).toEqual({
      model: "opus",
      hooks: { PostToolUse: [mine] },
    });
  });

  test("Codex gets hooks only when installed, and needs a one-time trust", async () => {
    const env = await createTestEnv();
    const ctx = await env.context();
    expect(await installHooks(ctx, "shelf")).toEqual([]);

    await mkdir(join(env.root, ".codex"));
    const [codex] = await installHooks(ctx, "shelf");
    expect(codex).toMatchObject({ harness: "codex", status: "installed", needsTrust: true });
    const hooks = (await readJson(join(env.root, ".codex/hooks.json"))).hooks;
    expect(hooks.PostToolUse[0].matcher).toBeUndefined();
  });

  test("a settings file that is not JSON is left alone", async () => {
    const env = await createTestEnv();
    const ctx = await env.context();
    await mkdir(join(env.root, ".claude"));
    await writeFile(settingsFile(env.root), "{ not json");

    const [change] = await installHooks(ctx, "shelf");
    expect(change?.status).toBe("skipped");
    expect(await readFile(settingsFile(env.root), "utf8")).toBe("{ not json");
  });

  test("setup --no-hooks removes them and doctor stops expecting them", async () => {
    const env = await createTestEnv();
    const ctx = await env.context();
    const options = { bundledSkill: "skill", hookCommand: "/bin/shelf" };

    const installed = await setup(ctx, options);
    expect(installed.hooks.map((c) => c.status)).toEqual(["installed"]);
    expect((await doctor(ctx, options)).checks.find((c) => c.id === "hooks")?.status).toBe("ok");

    await setup(ctx, { ...options, hooks: false });
    expect(await readJson(settingsFile(env.root))).toEqual({});
    const off = await env.context();
    expect(off.config.hooks).toBe(false);
    expect((await doctor(off, options)).checks.find((c) => c.id === "hooks")?.status).toBe("ok");
  });

  test("doctor notices hooks pointing at an old binary and fixes them", async () => {
    const env = await createTestEnv();
    const ctx = await env.context();
    await setup(ctx, { bundledSkill: "skill", hookCommand: "/old/shelf" });

    const options = { bundledSkill: "skill", hookCommand: "/new/shelf" };
    expect((await doctor(ctx, options)).checks.find((c) => c.id === "hooks")?.status).toBe("warn");
    await doctor(ctx, { ...options, fix: true });
    expect((await doctor(ctx, options)).checks.find((c) => c.id === "hooks")?.status).toBe("ok");
  });
});
