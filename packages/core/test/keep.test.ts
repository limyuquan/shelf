import { describe, expect, test } from "bun:test";
import { cp } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "../src/library/fs.ts";
import { readLockfile } from "../src/projection/lockfile.ts";
import { suggestActions } from "../src/services/actions.ts";
import { activity } from "../src/services/activity.ts";
import { listAttention } from "../src/services/attention.ts";
import { createContext } from "../src/services/context.ts";
import { catalog, setSkillLoanDays, showSkill, skillLoanDays } from "../src/services/library.ts";
import { borrow, keep, renew } from "../src/services/loans.ts";
import { listProjectOverviews } from "../src/services/overview.ts";
import { sessionNotice } from "../src/services/session.ts";
import { status, sweep } from "../src/services/status.ts";
import { used } from "../src/services/usage.ts";
import { appendToFile, createTestEnv, DAY, setupProject } from "./helpers.ts";

const loansOf = async (ctx: Parameters<typeof status>[0]) => {
  const report = await status(ctx);
  if (!report.initialized) throw new Error("expected an initialised project");
  return report;
};

describe("kept loans", () => {
  test("never come due, expire, or need attention for their due date", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["convex", "pdf"]);
    await borrow(ctx, ["convex", "pdf"], { days: 10 });
    const [result] = await keep(ctx, ["convex"], { keep: true });
    expect(result).toMatchObject({ skill: "convex", kept: true, changed: true });

    env.clock.advanceDays(8);
    expect((await listAttention(ctx)).map((item) => item.skill)).toEqual(["pdf"]);
    expect(await sessionNotice(ctx)).not.toContain("convex");

    env.clock.advanceDays(200);
    expect(await sessionNotice(ctx)).toContain("returned after going unused: pdf");
    const report = await loansOf(ctx);
    expect(report.expired).toEqual([]);
    expect(report.loans).toEqual([
      expect.objectContaining({ skill: "convex", kept: true, due: "active" }),
    ]);
    expect(report.actions).toEqual([]);
    expect((await sweep(ctx)).synced[0]?.expired).toEqual([]);
    expect(await pathExists(join(env.projectDir, ".agents/skills/convex"))).toBe(true);
    expect((await listProjectOverviews(ctx))[0]).toMatchObject({ dueSoon: 0, overdue: 0 });
  });

  test("still report content states and record uses", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["convex"]);
    await borrow(ctx, ["convex"], { keep: true });
    await appendToFile(join(env.projectDir, ".agents/skills/convex/SKILL.md"), "edit");
    env.clock.advanceDays(100);

    await used(ctx, ["convex"]);
    const [item] = await listAttention(ctx);
    expect(item).toMatchObject({ skill: "convex", reasons: ["modified"], kept: true });
    expect(item?.lastUsedAt).toEqual(env.clock.now());
    expect(suggestActions([item as NonNullable<typeof item>]).map((a) => a.command)).toEqual([
      "shelf promote convex",
    ]);
  });

  test("are written to the lockfile and kept by a clone on another machine", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["convex", "pdf"]);
    await borrow(ctx, ["convex", "pdf"]);
    await keep(ctx, ["convex"], { keep: true });

    const lockfile = await readLockfile(env.projectDir);
    expect(lockfile?.skills.convex?.keep).toBe(true);
    expect(lockfile?.skills.pdf).not.toHaveProperty("keep");

    const otherHome = join(env.root, "other-machine");
    await cp(join(env.shelfHome, "library"), join(otherHome, "library"), { recursive: true });
    const machine2 = await createContext({
      cwd: env.projectDir,
      env: { HOME: env.root, SHELF_HOME: otherHome },
      clock: env.clock,
    });
    await catalog(machine2);
    expect((await loansOf(machine2)).loans.map((loan) => [loan.skill, loan.kept])).toEqual([
      ["convex", true],
      ["pdf", false],
    ]);

    // Stopping on machine 2 reaches machine 1 through the lockfile, with a fresh
    // loan period rather than an immediate expiry.
    env.clock.advanceDays(60);
    await keep(machine2, ["convex"], { keep: false });
    expect((await readLockfile(env.projectDir))?.skills.convex).not.toHaveProperty("keep");
    const report = await loansOf(ctx);
    expect(report.expired).toEqual(["pdf"]);
    expect(report.loans).toEqual([
      expect.objectContaining({ skill: "convex", kept: false, due: "active", daysLeft: 30 }),
    ]);
  });

  test("keeping is idempotent and recorded with its reason; agents may keep", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["convex"]);
    await borrow(ctx, ["convex"]);
    const agent = { ...ctx, actor: "agent:claude-code" };

    await keep(agent, ["convex"], { keep: true, reason: "package.json depends on convex" });
    expect((await keep(ctx, ["convex"], { keep: true }))[0]?.changed).toBe(false);
    expect((await keep(agent, ["convex"], { keep: false }))[0]).toMatchObject({
      kept: false,
      changed: true,
    });
    await expect(keep(ctx, ["nope"], { keep: true })).rejects.toMatchObject({
      code: "NOT_BORROWED",
    });

    const kept = activity(ctx).filter((event) => event.type === "loan.kept");
    expect(kept.map((event) => [event.actor, event.detail])).toEqual([
      ["agent:claude-code", { keep: false }],
      ["agent:claude-code", { keep: true, reason: "package.json depends on convex" }],
    ]);
  });

  test("borrow --keep also keeps a skill that is already borrowed", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["convex"]);
    await borrow(ctx, ["convex"]);
    const [result] = await borrow(ctx, ["convex"], { keep: true });
    expect(result).toMatchObject({ status: "already-borrowed", kept: true });
  });
});

describe("per-skill loan length", () => {
  test("is used by borrow, renew, use and adoption on another machine", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["convex", "pdf"]);
    expect(await setSkillLoanDays(ctx, "convex", 14)).toEqual({
      skill: "convex",
      loanDays: 14,
      customLoanDays: 14,
    });
    const start = env.clock.now().getTime();

    const [convex, pdf] = await borrow(ctx, ["convex", "pdf"]);
    expect(convex?.dueAt.getTime()).toBe(start + 14 * DAY);
    expect(pdf?.dueAt.getTime()).toBe(start + 30 * DAY);
    expect((await renew(ctx, "convex")).dueAt.getTime()).toBe(start + 28 * DAY);
    expect((await renew(ctx, "convex", { days: 2 })).dueAt.getTime()).toBe(start + 30 * DAY);

    env.clock.advanceDays(20);
    await setSkillLoanDays(ctx, "pdf", 60);
    const uses = await used(ctx, ["convex", "pdf"]);
    expect(uses.map((use) => use.dueAt.getTime())).toEqual([
      start + 34 * DAY, // now + 14
      start + 80 * DAY, // now + 60
    ]);

    // The setting is machine-local: a fresh machine adopts with its own lengths.
    const otherHome = join(env.root, "other-machine");
    await cp(join(env.shelfHome, "library"), join(otherHome, "library"), { recursive: true });
    const machine2 = await createContext({
      cwd: env.projectDir,
      env: { HOME: env.root, SHELF_HOME: otherHome },
      clock: env.clock,
    });
    await setSkillLoanDays(machine2, "convex", 7);
    expect(
      (await loansOf(machine2)).loans.map((loan) => [loan.skill, loan.daysLeft, loan.loanDays]),
    ).toEqual([
      ["convex", 7, 7],
      ["pdf", 30, 30],
    ]);
  });

  test("is validated, shown in the catalog, and can be reset", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["convex"]);

    await expect(setSkillLoanDays(ctx, "convex", 0)).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    await expect(setSkillLoanDays(ctx, "convex", 1.5)).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    await expect(setSkillLoanDays(ctx, "convex", 91)).rejects.toMatchObject({
      code: "LOAN_LIMIT",
    });
    await expect(setSkillLoanDays(ctx, "nope", 10)).rejects.toMatchObject({
      code: "SKILL_NOT_FOUND",
    });

    await setSkillLoanDays(ctx, "convex", 90);
    expect((await catalog(ctx))[0]).toMatchObject({ loanDays: 90, customLoanDays: 90 });
    await setSkillLoanDays(ctx, "convex", null);
    expect(await showSkill(ctx, "convex")).toMatchObject({ loanDays: 30, customLoanDays: null });
    expect(await skillLoanDays(ctx, "convex")).toEqual({
      skill: "convex",
      loanDays: 30,
      customLoanDays: null,
    });
  });
});
