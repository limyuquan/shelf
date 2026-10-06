import { describe, expect, test } from "bun:test";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "../src/library/fs.ts";
import { readLockfile } from "../src/projection/lockfile.ts";
import { adopt } from "../src/services/adopt.ts";
import { diffSkill } from "../src/services/diff.ts";
import { doctor } from "../src/services/doctor.ts";
import { skillHistory } from "../src/services/history.ts";
import { refreshLibrary } from "../src/services/library.ts";
import { borrow, promote, update } from "../src/services/loans.ts";
import { initProject } from "../src/services/project.ts";
import { propagate } from "../src/services/propagate.ts";
import { scan } from "../src/services/scan.ts";
import { status, sweep } from "../src/services/status.ts";
import { appendToFile, createTestEnv, setupProject, type TestEnv } from "./helpers.ts";

async function handWrittenSkill(dir: string, name: string, body: string): Promise<string> {
  const skillDir = join(dir, name);
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    join(skillDir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${name} skill\n---\n${body}\n`,
  );
  return skillDir;
}

async function makeProject(env: TestEnv, name: string): Promise<string> {
  const dir = join(env.root, "code", name);
  await mkdir(join(dir, ".git"), { recursive: true });
  return dir;
}

describe("scan and adopt", () => {
  test("a copy matching an earlier library revision is adopted as behind, not edited", async () => {
    const env = await createTestEnv();
    const ctx = await env.context();
    const app = await makeProject(env, "app");
    const copy = await handWrittenSkill(join(app, ".agents/skills"), "review", "v1");
    await adopt(ctx, [copy]);
    await rm(join(app, ".agents/shelf.lock.json"));
    await appendToFile(join(env.shelfHome, "library/review/SKILL.md"), "v2");
    await refreshLibrary(ctx);

    const other = await makeProject(env, "other");
    const old = await handWrittenSkill(join(other, ".agents/skills"), "review", "v1");
    const [result] = await adopt(ctx, [old]);

    expect(result).toMatchObject({ library: "older", loan: { content: "behind" } });
  });

  test("--unedited records differing copies as older versions", async () => {
    const env = await createTestEnv();
    const ctx = await env.context();
    const newer = await handWrittenSkill(
      join(await makeProject(env, "a"), ".agents/skills"),
      "review",
      "v2",
    );
    const older = await handWrittenSkill(
      join(await makeProject(env, "b"), ".agents/skills"),
      "review",
      "v1",
    );
    const edited = await handWrittenSkill(
      join(await makeProject(env, "c"), ".agents/skills"),
      "review",
      "mine",
    );

    await adopt(ctx, [newer]);
    const [asOlder] = await adopt(ctx, [older], { unedited: true });
    const [asEdited] = await adopt(ctx, [edited]);

    expect(asOlder).toMatchObject({ library: "older", loan: { content: "behind" } });
    expect(asEdited).toMatchObject({ library: "differs", loan: { content: "modified" } });
    // A behind loan updates without --force; nothing is discarded.
    const [updated] = await update(await env.context(join(env.root, "code/b")), ["review"]);
    expect(updated?.status).toBe("updated");
    expect((await skillHistory(ctx, "review")).revisions.map((r) => r.source)).toContain("adopt");
  });

  test("scan groups copies by name and content across projects", async () => {
    const env = await createTestEnv();
    const ctx = await env.context();
    for (const name of ["a", "b", "c"]) {
      const project = await makeProject(env, name);
      await handWrittenSkill(join(project, ".claude/skills"), "review", name === "c" ? "v2" : "v1");
    }

    const report = await scan(ctx, join(env.root, "code"));

    const [group] = report.groups;
    expect(group?.name).toBe("review");
    expect(group?.copies).toBe(3);
    expect(group?.variants.map((variant) => variant.copies.length)).toEqual([2, 1]);
    expect(group?.inLibrary).toBe(false);
  });

  test("adopt imports a new skill and turns the copy into a loan", async () => {
    const env = await createTestEnv();
    const ctx = await env.context();
    const project = await makeProject(env, "app");
    const copy = await handWrittenSkill(join(project, ".claude/skills"), "review", "v1");

    const [result] = await adopt(ctx, [copy]);

    expect(result).toMatchObject({
      library: "imported",
      loan: { status: "created", content: "current" },
    });
    expect(await pathExists(join(env.shelfHome, "library/review/SKILL.md"))).toBe(true);
    // The configured targets are filled in, so every harness sees the skill.
    expect(await pathExists(join(project, ".agents/skills/review/SKILL.md"))).toBe(true);
    expect(Object.keys((await readLockfile(project))?.skills ?? {})).toEqual(["review"]);
  });

  test("adopting a drifted copy never overwrites the library", async () => {
    const env = await createTestEnv();
    const ctx = await env.context();
    const first = await makeProject(env, "first");
    const second = await makeProject(env, "second");
    await adopt(ctx, [await handWrittenSkill(join(first, ".claude/skills"), "review", "v1")]);

    const [result] = await adopt(ctx, [
      await handWrittenSkill(join(second, ".claude/skills"), "review", "v2"),
    ]);

    expect(result).toMatchObject({ library: "differs", loan: { content: "modified" } });
    expect(await Bun.file(join(env.shelfHome, "library/review/SKILL.md")).text()).toContain("v1");
  });

  test("a skill outside any project is imported without a loan", async () => {
    const env = await createTestEnv();
    const ctx = await env.context();
    const loose = await handWrittenSkill(join(env.root, "downloads"), "loose", "v1");

    const [result] = await adopt(ctx, [loose]);

    expect(result).toMatchObject({ library: "imported", loan: null });
  });
});

describe("history, diff and propagation", () => {
  test("log lists revisions newest first with their borrowers", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);
    await appendToFile(join(env.shelfHome, "library/pdf/SKILL.md"), "v2");

    const history = await skillHistory(ctx, "pdf");

    expect(history.revisions).toHaveLength(2);
    expect(history.revisions[0]?.latest).toBe(true);
    expect(history.revisions[1]?.borrowers).toEqual(["project"]);
    expect(history.borrowers[0]?.onLatest).toBe(false);
  });

  test("diff shows local edits by default, and pending library changes otherwise", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);

    await appendToFile(join(env.shelfHome, "library/pdf/SKILL.md"), "library line\n");
    const pending = await diffSkill(ctx, "pdf");
    expect(pending.to.side).toBe("library");
    expect(pending.files[0]?.patch).toContain("+library line");

    await appendToFile(join(env.projectDir, ".claude/skills/pdf/SKILL.md"), "local line\n");
    const local = await diffSkill(ctx, "pdf");
    expect(local.to.side).toBe("project");
    expect(local.files[0]?.patch).toContain("+local line");
  });

  test("propagate updates clean borrowers and skips edited ones", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);
    const clean = await env.context(await makeProject(env, "clean"));
    const edited = await env.context(await makeProject(env, "edited"));
    for (const other of [clean, edited]) {
      await initProject(other);
      await borrow(other, ["pdf"]);
    }
    await appendToFile(join(edited.cwd, ".claude/skills/pdf/SKILL.md"), "mine");
    await appendToFile(join(env.shelfHome, "library/pdf/SKILL.md"), "v2");

    const dry = await propagate(ctx, "pdf", { dryRun: true });
    expect(dry.projects.find((p) => p.project === "clean")?.status).toBe("updated");
    const stillBehind = await status(clean);
    expect(stillBehind.initialized && stillBehind.loans[0]?.content).toBe("behind");

    const result = await propagate(ctx, "pdf");

    const byProject = Object.fromEntries(result.projects.map((p) => [p.project, p.status]));
    expect(byProject).toEqual({
      project: "updated",
      clean: "updated",
      edited: "skipped-local-changes",
    });
  });

  test("promote then propagate brings every clean borrower to the new revision", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);
    const other = await env.context(await makeProject(env, "other"));
    await initProject(other);
    await borrow(other, ["pdf"]);

    for (const target of [".agents/skills", ".claude/skills"]) {
      await appendToFile(join(env.projectDir, target, "pdf/SKILL.md"), "better");
    }
    const promoted = await promote(ctx, "pdf");
    await propagate(ctx, "pdf");

    const report = await status(other);
    expect(report.initialized && report.loans[0]).toMatchObject({
      content: "current",
      revision: promoted.revision,
    });
  });
});

describe("sweep and doctor", () => {
  test("sweep expires overdue loans in every project", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"], { days: 5 });
    const other = await env.context(await makeProject(env, "other"));
    await initProject(other);
    await borrow(other, ["pdf"], { days: 20 });

    env.clock.advanceDays(6);
    const report = await sweep(ctx);

    const expired = Object.fromEntries(report.synced.map((s) => [s.project.name, s.expired]));
    expect(expired).toEqual({ project: ["pdf"], other: [] });
  });

  test("doctor reports and fixes missing projects, stale staging and the bundled skill", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);
    const gone = await env.context(await makeProject(env, "gone"));
    await initProject(gone);
    await rm(gone.cwd, { recursive: true });
    const staging = join(
      env.projectDir,
      ".claude/skills/pdf.shelf-0b5f3c2e-1d2a-4e5f-9a8b-7c6d5e4f3a2b",
    );
    await mkdir(staging, { recursive: true });

    const before = await doctor(ctx, { bundledSkill: "skill", hookCommand: "shelf" });
    const warned = before.checks
      .filter((check) => check.status === "warn")
      .map((check) => check.id);
    expect(warned).toEqual(["bundled-skill", "projects", "staging"]);

    const fixed = await doctor(ctx, { bundledSkill: "skill", hookCommand: "shelf", fix: true });
    expect(fixed.checks.every((check) => check.problems.length === check.fixed.length)).toBe(true);
    const after = await doctor(ctx, { bundledSkill: "skill", hookCommand: "shelf" });
    expect(after.checks.every((check) => check.status === "ok")).toBe(true);
    expect(await readdir(join(env.projectDir, ".claude/skills"))).toEqual(["pdf"]);
  });
});
