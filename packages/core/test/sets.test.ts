import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { readLockfile } from "../src/projection/lockfile.ts";
import { activity } from "../src/services/activity.ts";
import { borrow, keep } from "../src/services/loans.ts";
import { deleteSet, listSets, resolveSkillRefs, saveSet } from "../src/services/sets.ts";
import { status } from "../src/services/status.ts";
import { createTestEnv, setupProject } from "./helpers.ts";

const SKILLS = ["react", "playwright", "a11y", "pdf"];

describe("skill sets", () => {
  test("save, list, replace and delete", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, SKILLS);

    const saved = await saveSet(ctx, "frontend", {
      description: "UI work",
      skills: ["react", "playwright", "a11y", "react"],
    });
    expect(saved).toEqual({
      name: "frontend",
      description: "UI work",
      skills: ["a11y", "playwright", "react"],
    });
    await saveSet(ctx, "docs", { skills: ["pdf"] });
    expect((await listSets(ctx)).map((set) => set.name)).toEqual(["docs", "frontend"]);

    // Replacing members keeps the description unless a new one is given.
    const replaced = await saveSet(ctx, "frontend", { skills: ["react"] });
    expect(replaced).toEqual({ name: "frontend", description: "UI work", skills: ["react"] });
    expect(await saveSet(ctx, "frontend", { description: "", skills: ["react"] })).toMatchObject({
      description: "",
    });

    expect(await deleteSet(ctx, "frontend")).toMatchObject({ name: "frontend" });
    expect((await listSets(ctx)).map((set) => set.name)).toEqual(["docs"]);
    await expect(deleteSet(ctx, "frontend")).rejects.toMatchObject({ code: "SKILL_NOT_FOUND" });

    const events = activity(ctx).filter((event) => event.type.startsWith("set."));
    expect(events.map((event) => [event.type, event.detail?.set])).toEqual([
      ["set.deleted", "frontend"],
      ["set.saved", "frontend"],
      ["set.saved", "frontend"],
      ["set.saved", "docs"],
      ["set.saved", "frontend"],
    ]);
    expect(events[0]?.detail).toMatchObject({ skills: ["react"] });
    expect(events.at(-1)?.detail).toMatchObject({
      skills: ["react", "playwright", "a11y"],
      created: true,
    });
  });

  test("validates names and members", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, SKILLS);

    await expect(saveSet(ctx, "Front End", { skills: ["react"] })).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    await expect(saveSet(ctx, "frontend", { skills: [] })).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    await expect(saveSet(ctx, "frontend", { skills: ["react", "nope"] })).rejects.toMatchObject({
      code: "SKILL_NOT_FOUND",
    });
    expect(await listSets(ctx)).toEqual([]);

    // Sets can be built from other sets.
    await saveSet(ctx, "frontend", { skills: ["react", "a11y"] });
    expect(await saveSet(ctx, "@web", { skills: ["@frontend", "pdf"] })).toMatchObject({
      name: "web",
      skills: ["a11y", "pdf", "react"],
    });
  });

  test("@set refs expand in order without duplicates", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, SKILLS);
    await saveSet(ctx, "frontend", { skills: ["react", "playwright"] });

    expect(resolveSkillRefs(ctx, ["pdf", "@frontend", "react"])).toEqual([
      "pdf",
      "playwright",
      "react",
    ]);
    expect(() => resolveSkillRefs(ctx, ["@nope"])).toThrow(
      expect.objectContaining({
        code: "SKILL_NOT_FOUND",
        hint: expect.stringContaining("set list"),
      }),
    );
  });

  test("borrowing a set creates ordinary per-skill loans", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, SKILLS);
    await saveSet(ctx, "frontend", { skills: ["react", "playwright", "a11y"] });
    await borrow(ctx, ["react"]);

    const results = await borrow(ctx, ["@frontend", "pdf"]);
    expect(results.map((result) => [result.skill, result.status])).toEqual([
      ["a11y", "borrowed"],
      ["playwright", "borrowed"],
      ["react", "already-borrowed"],
      ["pdf", "borrowed"],
    ]);
    const lockfile = await readLockfile(env.projectDir);
    expect(Object.keys(lockfile?.skills ?? {}).sort()).toEqual([
      "a11y",
      "pdf",
      "playwright",
      "react",
    ]);
    expect(JSON.stringify(lockfile)).not.toContain("frontend");

    // An unknown set changes nothing.
    await expect(borrow(ctx, ["@nope"])).rejects.toMatchObject({ code: "SKILL_NOT_FOUND" });

    await keep(ctx, ["@frontend"], { keep: true });
    const report = await status(ctx);
    if (!report.initialized) throw new Error("expected an initialised project");
    expect(report.loans.filter((loan) => loan.kept).map((loan) => loan.skill)).toEqual([
      "a11y",
      "playwright",
      "react",
    ]);
  });

  test("archived skills drop out of a set until they return", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, SKILLS);
    await saveSet(ctx, "frontend", { skills: ["react", "playwright"] });

    await rm(join(env.shelfHome, "library/playwright"), { recursive: true });
    expect((await listSets(ctx))[0]?.skills).toEqual(["react"]);
    const results = await borrow(ctx, ["@frontend"]);
    expect(results.map((result) => result.skill)).toEqual(["react"]);

    await rm(join(env.shelfHome, "library/react"), { recursive: true });
    await expect(borrow(ctx, ["@frontend"])).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });
});
