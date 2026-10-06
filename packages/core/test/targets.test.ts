import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { lstat, mkdir, readlink, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "../src/library/fs.ts";
import { readLockfile } from "../src/projection/lockfile.ts";
import { removeSkillCopies, writeSkillCopies } from "../src/projection/materialize.ts";
import { borrow, promote, returnSkill } from "../src/services/loans.ts";
import { status, sync } from "../src/services/status.ts";
import { changeTargets, describeTargets } from "../src/services/targets.ts";
import { openDatabase } from "../src/store/database.ts";
import { MIGRATIONS } from "../src/store/migrations.ts";
import { appendToFile, createTestEnv, setupProject } from "./helpers.ts";

describe("link mode", () => {
  test("keeps one copy and links the other targets to it", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);

    await borrow(ctx, ["pdf"], { mode: "link" });

    const claude = join(env.projectDir, ".claude/skills/pdf");
    expect((await lstat(claude)).isSymbolicLink()).toBe(true);
    expect(await readlink(claude)).toBe("../../.agents/skills/pdf");
    expect((await readLockfile(env.projectDir))?.skills.pdf?.mode).toBe("link");
    const report = await status(ctx);
    expect(report.initialized && report.loans[0]?.content).toBe("current");
  });

  test("edits through the link are detected, promoted, and returned cleanly", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"], { mode: "link" });

    await appendToFile(join(env.projectDir, ".claude/skills/pdf/SKILL.md"), "edit");
    const edited = await status(ctx);
    expect(edited.initialized && edited.loans[0]?.content).toBe("modified");

    await promote(ctx, "pdf");
    expect((await lstat(join(env.projectDir, ".claude/skills/pdf"))).isSymbolicLink()).toBe(true);
    await returnSkill(ctx, "pdf");
    expect(await pathExists(join(env.projectDir, ".agents/skills/pdf"))).toBe(false);
    expect(await lstat(join(env.projectDir, ".claude/skills/pdf")).catch(() => null)).toBeNull();
  });

  test("sync recreates a deleted link", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"], { mode: "link" });
    await rm(join(env.projectDir, ".claude/skills/pdf"));

    await sync(ctx);
    expect((await lstat(join(env.projectDir, ".claude/skills/pdf"))).isSymbolicLink()).toBe(true);
  });
});

describe("project targets", () => {
  test("suggests harnesses that are present but do not read .agents/skills", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, []);
    await mkdir(join(env.projectDir, ".kiro"));

    const report = await describeTargets(ctx);
    const kiro = report.harnesses.find((h) => h.id === "kiro");
    expect(kiro).toMatchObject({ detected: true, enabled: false, readsAgentsDir: false });
    expect(report.custom).toBe(false);
  });

  test("adding and removing targets moves every loan and is recorded in the lockfile", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);

    await changeTargets(ctx, { add: ["kiro"], remove: ["claude"] });

    expect(await pathExists(join(env.projectDir, ".kiro/skills/pdf/SKILL.md"))).toBe(true);
    expect(await pathExists(join(env.projectDir, ".claude/skills/pdf"))).toBe(false);
    const lockfile = await readLockfile(env.projectDir);
    expect(lockfile?.targets).toEqual([".agents/skills", ".kiro/skills"]);
    expect(lockfile?.skills.pdf?.targets).toEqual([".agents/skills", ".kiro/skills"]);

    // New borrows follow the project's targets.
    const report = await status(ctx);
    expect(report.initialized && report.loans[0]?.content).toBe("current");

    await changeTargets(ctx, { reset: true });
    expect((await readLockfile(env.projectDir))?.targets).toBeUndefined();
    expect(await pathExists(join(env.projectDir, ".claude/skills/pdf/SKILL.md"))).toBe(true);
  });

  test("refuses to drop a directory holding local edits", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);
    await appendToFile(join(env.projectDir, ".claude/skills/pdf/SKILL.md"), "edit");

    await expect(changeTargets(ctx, { remove: ["claude"] })).rejects.toMatchObject({
      code: "LOCAL_CHANGES",
    });
  });

  test("rejects paths outside the project", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, []);
    await expect(changeTargets(ctx, { add: ["../elsewhere"] })).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
  });
});

describe("symlinked harness directories", () => {
  /** `.claude/skills` → `.agents/skills`, a common hand-made setup. */
  async function linkClaudeToAgents(projectDir: string): Promise<void> {
    await mkdir(join(projectDir, ".agents/skills"), { recursive: true });
    await mkdir(join(projectDir, ".claude"));
    await symlink("../.agents/skills", join(projectDir, ".claude/skills"));
  }

  test("count as one target and are not suggested again", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await linkClaudeToAgents(env.projectDir);

    const report = await describeTargets(ctx);
    expect(report.targets).toEqual([".agents/skills"]);
    expect(report.harnesses.find((h) => h.id === "claude")).toMatchObject({
      enabled: false,
      detected: true,
      sharedWith: ".agents/skills",
    });

    await borrow(ctx, ["pdf"]);
    expect((await readLockfile(env.projectDir))?.skills.pdf?.targets).toEqual([".agents/skills"]);
    const borrowed = await status(ctx);
    expect(borrowed.initialized && borrowed.loans[0]?.content).toBe("current");
  });

  test("removing one name never deletes the copy behind the other", async () => {
    const env = await createTestEnv();
    await setupProject(env, ["pdf"]);
    await linkClaudeToAgents(env.projectDir);
    const source = join(env.shelfHome, "library/pdf");
    const targets = [".agents/skills", ".claude/skills"];

    // Link mode must not turn the only real copy into a link to itself.
    await writeSkillCopies(env.projectDir, { targets, mode: "link" }, "pdf", source);
    expect((await lstat(join(env.projectDir, ".agents/skills/pdf"))).isDirectory()).toBe(true);

    await removeSkillCopies(env.projectDir, [".claude/skills"], "pdf", [".agents/skills"]);
    expect(await pathExists(join(env.projectDir, ".agents/skills/pdf/SKILL.md"))).toBe(true);
  });
});

describe("schema migrations", () => {
  test("a version-1 database is upgraded in place", async () => {
    const env = await createTestEnv();
    const file = join(env.root, "v1.db");
    const v1 = new Database(file, { create: true });
    v1.run(MIGRATIONS[0] as string);
    v1.run("PRAGMA user_version = 1");
    v1.run(
      "INSERT INTO skills (name, description, latest_revision, created_at) VALUES ('a', 'a', 'sha256:x', '2026-01-01')",
    );
    v1.run(
      "INSERT INTO revisions (skill_id, hash, parent, source, created_at) VALUES (1, 'sha256:x', NULL, 'library', '2026-01-01')",
    );
    v1.close();

    const db = openDatabase(file);
    expect(db.query("PRAGMA user_version").get()).toEqual({ user_version: MIGRATIONS.length });
    expect(db.query("SELECT COUNT(*) AS n FROM revisions").get()).toEqual({ n: 1 });
    db.run(
      "INSERT INTO revisions (skill_id, hash, source, created_at) VALUES (1, 'sha256:y', 'import', 'now')",
    );
    db.run(
      "INSERT INTO revisions (skill_id, hash, source, created_at) VALUES (1, 'sha256:z', 'adopt', 'now')",
    );
    expect(
      db
        .query("SELECT COUNT(*) AS n FROM pragma_table_info('loans') WHERE name = 'last_used_at'")
        .get(),
    ).toEqual({ n: 1 });
    expect(
      db
        .query(
          `SELECT (SELECT COUNT(*) FROM pragma_table_info('loans') WHERE name = 'keep') +
                  (SELECT COUNT(*) FROM pragma_table_info('skills') WHERE name = 'loan_days') AS n`,
        )
        .get(),
    ).toEqual({ n: 2 });
    db.close();
  });
});
