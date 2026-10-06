import { describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { librarySkillPath } from "../src/library/library.ts";
import { insights } from "../src/services/insights.ts";
import { refreshLibrary } from "../src/services/library.ts";
import { borrow } from "../src/services/loans.ts";
import { initProject } from "../src/services/project.ts";
import { used } from "../src/services/usage.ts";
import { createTestEnv, setupProject, type TestEnv } from "./helpers.ts";

const tokens = (text: string) => Math.ceil(text.length / 4);
const skillFile = (env: TestEnv, name: string) =>
  readFile(join(env.shelfHome, "library", name, "SKILL.md"), "utf8");

async function writeSkill(dir: string, name: string, description: string): Promise<string> {
  const content = `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`;
  await mkdir(join(dir, name), { recursive: true });
  await writeFile(join(dir, name, "SKILL.md"), content);
  return content;
}

async function secondProject(env: TestEnv, name: string) {
  const dir = join(env.root, name);
  await mkdir(join(dir, ".git"), { recursive: true });
  const ctx = await env.context(dir);
  await initProject(ctx);
  return { dir, ctx };
}

describe("insights", () => {
  test("estimates session cost from descriptions and use cost from SKILL.md", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf", "git"]);
    await borrow(ctx, ["pdf", "git"]);
    const pdfBody = await skillFile(env, "pdf");

    // The library moves on; the project keeps the revision it borrowed.
    const longer = `---\nname: pdf\ndescription: ${"Read and fill PDF forms. ".repeat(4)}\n---\n\n# pdf\n`;
    await writeFile(join(librarySkillPath(ctx.paths, "pdf"), "SKILL.md"), longer);
    await refreshLibrary(ctx);

    const result = await insights(ctx);
    const project = result.projects[0];
    const pdf = project?.skills.find((skill) => skill.skill === "pdf");
    expect(pdf).toMatchObject({
      descriptionTokens: tokens("pdfThe pdf skill"),
      bodyTokens: tokens(pdfBody),
    });
    expect(project?.sessionTokens).toBe(tokens("pdfThe pdf skill") + tokens("gitThe git skill"));
    expect(project?.globalTokens).toBe(0);

    const library = result.skills.find((skill) => skill.name === "pdf");
    expect(library).toMatchObject({
      descriptionTokens: tokens(`pdf${"Read and fill PDF forms. ".repeat(4).trim()}`),
      bodyTokens: tokens(longer),
      borrowers: 1,
    });
  });

  test("counts active days in the last 30 days, per project and per skill", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf", "git"]);
    await borrow(ctx, ["pdf", "git"]);
    const other = await secondProject(env, "other");
    await borrow(other.ctx, ["pdf"]);

    await used(ctx, ["pdf"]); // day 0: falls out of the window
    env.clock.advanceDays(1);
    await used(ctx, ["pdf"]); // day 1: the window's first day
    env.clock.advanceDays(29);
    await used(ctx, ["pdf"]); // day 30: today, in both projects
    await used(other.ctx, ["pdf"]);

    const result = await insights(ctx);
    expect(result.usage.days).toHaveLength(30);
    expect(result.usage.days.at(-1)).toBe(env.clock.now().toISOString().slice(0, 10));

    const pdf = result.skills.find((skill) => skill.name === "pdf");
    expect(pdf?.activeDays30).toBe(2);
    expect(pdf?.daily).toHaveLength(30);
    expect(pdf?.daily[0]).toBe(1);
    expect(pdf?.daily.at(-1)).toBe(2); // two projects today
    expect(pdf?.lastUsedAt).toEqual(env.clock.now());
    expect(pdf?.borrowers).toBe(2);

    const mine = result.projects.find((project) => project.name === "project");
    expect(mine?.skills.find((skill) => skill.skill === "pdf")?.activeDays30).toBe(2);
    const theirs = result.projects.find((project) => project.name === "other");
    expect(theirs?.skills[0]).toMatchObject({ skill: "pdf", activeDays30: 1 });

    expect(result.usage.active[0]).toBe(1);
    expect(result.usage.active.at(-1)).toBe(1); // one distinct skill, two projects
    expect(result.usage.active.slice(1, -1).every((count) => count === 0)).toBe(true);
  });

  test("never-used skills, and projects whose directory is gone", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf", "git", "idle"]);
    await borrow(ctx, ["pdf", "git"]);
    await used(ctx, ["pdf"]);
    const gone = await secondProject(env, "gone");
    await borrow(gone.ctx, ["git"]);
    await rm(gone.dir, { recursive: true });

    const result = await insights(ctx);
    const byName = Object.fromEntries(result.skills.map((skill) => [skill.name, skill]));
    expect(byName.pdf).toMatchObject({ neverUsed: false, activeDays30: 1 });
    expect(byName.git).toMatchObject({ neverUsed: true, lastUsedAt: null, borrowers: 2 });
    expect(byName.idle).toMatchObject({ neverUsed: true, borrowers: 0, activeDays30: 0 });
    expect(result.projects.map((project) => project.name)).toEqual(["project"]);
  });

  test("finds user-level skills once, across harness dirs and symlinks", async () => {
    const env = await createTestEnv();
    const claude = join(env.root, ".claude/skills");
    const agents = join(env.root, ".agents/skills");
    const review = await writeSkill(claude, "review", "Review a pull request for correctness");
    await writeSkill(agents, "lint", "Lint");
    await writeSkill(claude, "shelf", "Manage skills with shelf");
    // The same skill linked into a second harness dir.
    await symlink(join(claude, "review"), join(agents, "review"));
    // A whole harness dir that is an alias of another.
    await mkdir(join(env.root, ".copilot"), { recursive: true });
    await symlink(agents, join(env.root, ".copilot/skills"));
    // Invalid entries are counted, not listed; directories without SKILL.md are ignored.
    await mkdir(join(claude, "broken"), { recursive: true });
    await writeFile(join(claude, "broken", "SKILL.md"), "# no frontmatter\n");
    await mkdir(join(claude, "notes"), { recursive: true });

    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);
    const result = await insights(ctx);

    expect(result.globalSkills.map((skill) => skill.name).sort()).toEqual([
      "lint",
      "review",
      "shelf",
    ]);
    expect(result.invalidGlobalSkills).toBe(1);
    const byName = Object.fromEntries(result.globalSkills.map((skill) => [skill.name, skill]));
    expect(byName.review?.harnessDirs.sort()).toEqual([
      ".agents/skills",
      ".claude/skills",
      ".copilot/skills",
    ]);
    expect(byName.review).toMatchObject({
      descriptionTokens: tokens("reviewReview a pull request for correctness"),
      bodyTokens: tokens(review),
      bundled: false,
    });
    expect(byName.lint?.harnessDirs.sort()).toEqual([".agents/skills", ".copilot/skills"]);
    expect(byName.shelf?.bundled).toBe(true);

    const total = result.globalSkills.reduce((sum, skill) => sum + skill.descriptionTokens, 0);
    expect(result.projects[0]?.globalTokens).toBe(total);
  });
});
