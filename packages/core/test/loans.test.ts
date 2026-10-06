import { describe, expect, test } from "bun:test";
import { cp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "../src/library/fs.ts";
import { readLockfile, writeLockfileSync } from "../src/projection/lockfile.ts";
import { createContext } from "../src/services/context.ts";
import { catalog, createSkill } from "../src/services/library.ts";
import { borrow, promote, renew, returnSkill, setDue, update } from "../src/services/loans.ts";
import { listProjectOverviews } from "../src/services/overview.ts";
import { initProject } from "../src/services/project.ts";
import { status, sync } from "../src/services/status.ts";
import { appendToFile, createTestEnv, setupProject } from "./helpers.ts";

const copies = (projectDir: string, skill: string) => [
  join(projectDir, ".agents/skills", skill),
  join(projectDir, ".claude/skills", skill),
];

describe("borrow", () => {
  test("copies the skill into every target and records it in the lockfile", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);

    const [result] = await borrow(ctx, ["pdf"]);

    expect(result?.status).toBe("borrowed");
    for (const path of copies(env.projectDir, "pdf")) {
      expect(await pathExists(join(path, "SKILL.md"))).toBe(true);
    }
    const lockfile = await readLockfile(env.projectDir);
    expect(lockfile?.skills.pdf?.revision).toBe(result?.revision as string);
  });

  test("is idempotent", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);

    const [again] = await borrow(ctx, ["pdf"]);

    expect(again?.status).toBe("already-borrowed");
  });

  test("never overwrites a skill directory it does not manage", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    const handWritten = join(env.projectDir, ".claude/skills/pdf");
    await mkdir(handWritten, { recursive: true });
    await writeFile(join(handWritten, "SKILL.md"), "mine");

    await expect(borrow(ctx, ["pdf"])).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await Bun.file(join(handWritten, "SKILL.md")).text()).toBe("mine");
  });

  test("validates every name before changing anything", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);

    await expect(borrow(ctx, ["pdf", "missing"])).rejects.toMatchObject({
      code: "SKILL_NOT_FOUND",
    });
    expect(await pathExists(copies(env.projectDir, "pdf")[0] as string)).toBe(false);
  });

  test("requires an initialised project", async () => {
    const env = await createTestEnv();
    const ctx = await env.context();
    await expect(borrow(ctx, ["pdf"])).rejects.toMatchObject({ code: "NOT_INITIALIZED" });
  });
});

describe("expiry", () => {
  test("status returns overdue skills and removes their copies", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"], { days: 10 });

    env.clock.advanceDays(11);
    const report = await status(ctx);

    expect(report.initialized && report.expired).toEqual(["pdf"]);
    expect(report.initialized && report.loans).toEqual([]);
    for (const path of copies(env.projectDir, "pdf")) expect(await pathExists(path)).toBe(false);
    expect((await readLockfile(env.projectDir))?.skills).toEqual({});
  });

  test("keeps overdue copies that carry local edits", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"], { days: 10 });
    await appendToFile(join(env.projectDir, ".claude/skills/pdf/SKILL.md"), "edit");

    env.clock.advanceDays(11);
    const report = await status(ctx);

    expect(report.initialized && report.expired).toEqual([]);
    expect(report.initialized && report.loans[0]).toMatchObject({
      due: "overdue",
      content: "modified",
    });
  });

  test("renewal extends from the due date and respects the loan limit", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    const [loan] = await borrow(ctx, ["pdf"], { days: 10 });

    const renewed = await renew(ctx, "pdf", { days: 20, reason: "still in use" });

    expect(renewed.dueAt.getTime() - (loan?.dueAt.getTime() ?? 0)).toBe(20 * 24 * 60 * 60 * 1000);
    await expect(setDue(ctx, "pdf", "+200d")).rejects.toMatchObject({ code: "LOAN_LIMIT" });
  });
});

describe("library changes", () => {
  test("library edits show as behind and update applies them", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);
    await appendToFile(join(env.shelfHome, "library/pdf/SKILL.md"), "\nNew guidance.\n");

    const before = await status(ctx);
    expect(before.initialized && before.loans[0]?.content).toBe("behind");

    await update(ctx);
    const after = await status(ctx);
    expect(after.initialized && after.loans[0]?.content).toBe("current");
    expect(await Bun.file(join(env.projectDir, ".agents/skills/pdf/SKILL.md")).text()).toContain(
      "New guidance.",
    );
  });

  test("sync applies updates only to follow loans", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pinned", "tracking"]);
    await borrow(ctx, ["pinned"]);
    await borrow(ctx, ["tracking"], { policy: "follow" });
    await appendToFile(join(env.shelfHome, "library/pinned/SKILL.md"), "v2");
    await appendToFile(join(env.shelfHome, "library/tracking/SKILL.md"), "v2");

    const report = await sync(ctx);

    expect(report.updated).toEqual(["tracking"]);
  });

  test("promote publishes project edits; other projects then see behind", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);

    const otherDir = join(env.root, "other");
    await mkdir(join(otherDir, ".git"), { recursive: true });
    const other = await env.context(otherDir);
    await initProject(other);
    await borrow(other, ["pdf"]);

    await appendToFile(join(env.projectDir, ".agents/skills/pdf/SKILL.md"), "\nBetter.\n");
    await cp(
      join(env.projectDir, ".agents/skills/pdf/SKILL.md"),
      join(env.projectDir, ".claude/skills/pdf/SKILL.md"),
    );
    await promote(ctx, "pdf");

    const here = await status(ctx);
    const there = await status(other);
    expect(here.initialized && here.loans[0]?.content).toBe("current");
    expect(there.initialized && there.loans[0]?.content).toBe("behind");
  });

  test("promote refuses to overwrite a library that also changed", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);
    await appendToFile(join(env.shelfHome, "library/pdf/SKILL.md"), "library edit");
    for (const path of copies(env.projectDir, "pdf")) {
      await appendToFile(join(path, "SKILL.md"), "project edit");
    }

    await expect(promote(ctx, "pdf")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("return refuses to discard local edits unless forced", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);
    await appendToFile(join(env.projectDir, ".claude/skills/pdf/SKILL.md"), "edit");

    await expect(returnSkill(ctx, "pdf")).rejects.toMatchObject({ code: "LOCAL_CHANGES" });
    await returnSkill(ctx, "pdf", { force: true });
    expect(await pathExists(join(env.projectDir, ".claude/skills/pdf"))).toBe(false);
  });

  test("sync restores a deleted copy without touching an edited one", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);
    const [agentsCopy, claudeCopy] = copies(env.projectDir, "pdf") as [string, string];
    await rm(agentsCopy, { recursive: true });

    await sync(ctx);
    expect(await pathExists(agentsCopy)).toBe(true);

    await rm(agentsCopy, { recursive: true });
    await appendToFile(join(claudeCopy, "SKILL.md"), "edit");
    const report = await status(ctx);
    expect(report.initialized && report.loans[0]?.content).toBe("modified");
  });
});

describe("projects across machines and moves", () => {
  test("a moved project keeps its identity and loans", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);
    const movedDir = join(env.root, "moved");
    await rename(env.projectDir, movedDir);

    const report = await status(await env.context(movedDir));

    expect(report.initialized && report.project.path).toBe(movedDir);
    expect(report.initialized && report.loans.map((loan) => loan.skill)).toEqual(["pdf"]);
    expect(await listProjectOverviews(ctx)).toHaveLength(1);
  });

  test("a clone adopts known skills and preserves unknown lockfile entries", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);
    const lockfile = await readLockfile(env.projectDir);
    if (!lockfile) throw new Error("expected a lockfile");
    writeLockfileSync(env.projectDir, {
      ...lockfile,
      skills: {
        ...lockfile.skills,
        foreign: { revision: "sha256:abc", targets: [".agents/skills"] },
      },
    });

    // Another machine: a fresh database whose library has `pdf` but not `foreign`.
    const otherHome = join(env.root, "other-machine");
    await cp(join(env.shelfHome, "library"), join(otherHome, "library"), { recursive: true });
    const machine2 = await createContext({
      cwd: env.projectDir,
      env: { HOME: env.root, SHELF_HOME: otherHome },
      clock: env.clock,
    });
    await catalog(machine2);

    const report = await status(machine2);

    expect(report.initialized && report.loans.map((loan) => loan.skill)).toEqual(["pdf"]);
    expect(report.initialized && report.warnings.join()).toContain("foreign");
    // Any lockfile rewrite on this machine must keep the entry it cannot resolve.
    await createSkill(machine2, "extra", "Only on machine 2");
    await borrow(machine2, ["extra"]);
    expect(Object.keys((await readLockfile(env.projectDir))?.skills ?? {})).toEqual([
      "extra",
      "foreign",
      "pdf",
    ]);
  });
});
