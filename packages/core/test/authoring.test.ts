import { describe, expect, test } from "bun:test";
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ShelfError } from "../src/errors.ts";
import { pathExists } from "../src/library/fs.ts";
import { lintSkill } from "../src/library/lint.ts";
import { setFrontmatterName } from "../src/library/skill-file.ts";
import { activity } from "../src/services/activity.ts";
import {
  archiveLibrarySkill,
  duplicateSkill,
  lintLibrary,
  renameSkill,
} from "../src/services/authoring.ts";
import { skillHistory } from "../src/services/history.ts";
import { catalog, createSkill, saveSkillContent, showSkill } from "../src/services/library.ts";
import { borrow, returnSkill } from "../src/services/loans.ts";
import { createTestEnv, setupProject } from "./helpers.ts";

const skillMd = (name: string, extra = "") =>
  `---\n# keep this comment\nname: ${name}   # the id\ndescription: "Use when testing renames"\n${extra}---\n\nBody text\n`;

async function rejection(promise: Promise<unknown>): Promise<ShelfError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ShelfError);
  return error as ShelfError;
}

describe("rename", () => {
  test("moves the directory, rewrites only the name and keeps history", async () => {
    const env = await createTestEnv();
    const ctx = await env.context();
    await createSkill(ctx, "pdf", "Use when reading PDFs");
    await writeFile(join(env.shelfHome, "library/pdf/notes.md"), "notes");
    await saveSkillContent(ctx, "pdf", skillMd("pdf", "license: MIT\r\n"));

    const renamed = await renameSkill(ctx, "pdf", "pdf-tools");

    expect(renamed.name).toBe("pdf-tools");
    expect(await pathExists(join(env.shelfHome, "library/pdf"))).toBe(false);
    expect(renamed.files).toEqual(["SKILL.md", "notes.md"]);
    expect(renamed.content).toBe(skillMd("pdf", "license: MIT\r\n").replace("pdf ", "pdf-tools "));
    // create + save + rename: three revisions on the same skill.
    expect((await skillHistory(ctx, "pdf-tools")).revisions).toHaveLength(3);
    expect((await catalog(ctx)).map((entry) => entry.name)).toEqual(["pdf-tools"]);
    const [latest] = activity(ctx, { skill: "pdf-tools" }).filter(
      (event) => event.type === "skill.renamed",
    );
    expect(latest?.detail).toEqual({ from: "pdf", to: "pdf-tools" });
  });

  test("refuses invalid, taken or archived names", async () => {
    const env = await createTestEnv();
    const ctx = await env.context();
    await createSkill(ctx, "pdf", "Use when reading PDFs");
    await createSkill(ctx, "git", "Use when committing");

    expect((await rejection(renameSkill(ctx, "pdf", "PDF"))).code).toBe("INVALID_ARGUMENT");
    expect((await rejection(renameSkill(ctx, "pdf", "git"))).code).toBe("SKILL_EXISTS");
    expect((await rejection(renameSkill(ctx, "nope", "new"))).code).toBe("SKILL_NOT_FOUND");
    await archiveLibrarySkill(ctx, "git");
    expect((await rejection(renameSkill(ctx, "pdf", "git"))).code).toBe("SKILL_EXISTS");
  });

  test("refuses a borrowed skill, naming the borrowers", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);

    const error = await rejection(renameSkill(ctx, "pdf", "pdf-tools"));
    expect(error.code).toBe("CONFLICT");
    expect(error.hint).toContain("Return it from project first");
    expect(await pathExists(join(env.shelfHome, "library/pdf"))).toBe(true);

    await returnSkill(ctx, "pdf");
    expect((await renameSkill(ctx, "pdf", "pdf-tools")).name).toBe("pdf-tools");
  });
});

describe("duplicate", () => {
  test("copies the skill under a new name with its own history", async () => {
    const env = await createTestEnv();
    const ctx = await env.context();
    await createSkill(ctx, "pdf", "Use when reading PDFs");
    await writeFile(join(env.shelfHome, "library/pdf/notes.md"), "notes");

    const copy = await duplicateSkill(ctx, "pdf", "pdf-copy");

    expect(copy.files).toEqual(["SKILL.md", "notes.md"]);
    expect(copy.content).toContain("name: pdf-copy\n");
    expect(copy.content).toContain("# pdf\n");
    expect((await showSkill(ctx, "pdf")).content).toContain("name: pdf\n");
    expect((await skillHistory(ctx, "pdf-copy")).revisions).toHaveLength(1);
    const created = activity(ctx, { skill: "pdf-copy" });
    expect(created.map((event) => [event.type, event.detail?.duplicatedFrom])).toEqual([
      ["skill.created", "pdf"],
    ]);
    // Nothing is left behind from staging.
    expect((await readdir(env.shelfHome)).filter((entry) => entry.includes(".shelf-"))).toEqual([]);
  });

  test("refuses a taken name", async () => {
    const env = await createTestEnv();
    const ctx = await env.context();
    await createSkill(ctx, "pdf", "Use when reading PDFs");
    expect((await rejection(duplicateSkill(ctx, "pdf", "pdf"))).code).toBe("SKILL_EXISTS");
  });
});

describe("archive", () => {
  test("moves the skill under archive/, keeps its revisions and can be restored", async () => {
    const env = await createTestEnv();
    const ctx = await env.context();
    await createSkill(ctx, "pdf", "Use when reading PDFs");
    const revision = (await showSkill(ctx, "pdf")).revision;

    const result = await archiveLibrarySkill(ctx, "pdf", { reason: "archived from the dashboard" });

    expect(result.path).toBe(join(env.shelfHome, "archive/pdf-2026-10-06T12-00-00"));
    expect(await Bun.file(join(result.path, "SKILL.md")).exists()).toBe(true);
    expect(await catalog(ctx)).toEqual([]);
    expect((await readdir(join(env.shelfHome, "objects"))).length).toBeGreaterThan(0);
    const [event] = activity(ctx, { skill: "pdf" });
    expect(event).toMatchObject({
      type: "skill.archived",
      detail: { reason: "archived from the dashboard", path: result.path },
    });

    // Restoring by hand: move it back into the library.
    await rename(result.path, join(env.shelfHome, "library/pdf"));
    const restored = await showSkill(ctx, "pdf");
    expect(restored.revision).toBe(revision);
    expect(restored.revisions).toBe(1);
  });

  test("a second archive of the same name doesn't collide", async () => {
    const env = await createTestEnv();
    const ctx = await env.context();
    await createSkill(ctx, "pdf", "Use when reading PDFs");
    const first = await archiveLibrarySkill(ctx, "pdf");
    await createSkill(ctx, "pdf", "Use when reading PDFs again");
    const second = await archiveLibrarySkill(ctx, "pdf");
    expect(second.path).toBe(`${first.path}-2`);
  });

  test("refuses a borrowed skill", async () => {
    const env = await createTestEnv();
    const ctx = await setupProject(env, ["pdf"]);
    await borrow(ctx, ["pdf"]);
    const error = await rejection(archiveLibrarySkill(ctx, "pdf"));
    expect(error.code).toBe("CONFLICT");
    expect(error.hint).toContain("Return it from project first");
    expect((await catalog(ctx)).map((entry) => entry.name)).toEqual(["pdf"]);
  });
});

describe("setFrontmatterName", () => {
  test("keeps quotes and quotes names YAML would read as other types", () => {
    expect(setFrontmatterName("---\nname: 'a'\ndescription: d\n---\n", "a", "b", "f")).toBe(
      "---\nname: 'b'\ndescription: d\n---\n",
    );
    expect(setFrontmatterName("---\nname: a\n---\nname: a\n", "a", "123", "f")).toBe(
      '---\nname: "123"\n---\nname: a\n',
    );
  });

  test("refuses a name it can't find", () => {
    expect(() => setFrontmatterName("---\nname: >-\n  a\n---\n", "a", "b", "f")).toThrow(
      ShelfError,
    );
  });
});

describe("lint", () => {
  const md = (frontmatter: string, body = "\nDo the thing.\n") =>
    `---\n${frontmatter}\n---\n${body}`;

  test("a good skill has no issues and counts tokens", () => {
    const result = lintSkill(md("name: pdf\ndescription: Use when reading PDFs"), "pdf");
    expect(result).toEqual({ issues: [], descriptionTokens: 6, bodyTokens: 4 });
  });

  test("reports errors for the Agent Skills format", () => {
    const messages = (content: string, dir?: string) =>
      lintSkill(content, dir).issues.map((issue) => `${issue.level}: ${issue.message}`);

    expect(messages("no frontmatter")).toEqual([
      "error: SKILL.md must start with YAML frontmatter between --- lines",
    ]);
    expect(messages(md("name: [unclosed"))[0]).toStartWith("error: Frontmatter is not valid YAML");
    expect(messages(md("description: Use when x"))).toEqual(["error: name is required"]);
    expect(messages(md("name: Bad_Name\ndescription: Use when x"))[0]).toStartWith(
      "error: name must be lowercase",
    );
    expect(messages(md(`name: ${"a".repeat(65)}\ndescription: Use when x`))).toEqual([
      "error: name is 65 characters; the limit is 64",
    ]);
    expect(messages(md("name: pdf\ndescription: Use when x"), "other")).toEqual([
      'error: name "pdf" must match the skill\'s directory "other"',
    ]);
    expect(messages(md("name: pdf"))).toEqual(["error: description is required"]);
    expect(messages(md(`name: pdf\ndescription: ${"when ".repeat(210)}`))[0]).toStartWith(
      "error: description is 1049 characters",
    );
  });

  test("warns about costly or trigger-less descriptions and empty bodies", () => {
    const long = `Use when ${"x".repeat(300)}`;
    const levels = (content: string) => lintSkill(content).issues.map((issue) => issue.message);
    expect(levels(md(`name: pdf\ndescription: ${long}`))).toEqual([
      "description is 309 characters; every session loads it, so aim for under 300",
    ]);
    expect(levels(md("name: pdf\ndescription: PDF tools"))).toEqual([
      'description doesn\'t say when to use the skill: add "Use when …"',
    ]);
    expect(levels(md("name: pdf\ndescription: Use when x", "\n"))).toEqual([
      "The body is empty: add the instructions an agent follows",
    ]);
  });

  test("lints library skills by name or all of them", async () => {
    const env = await createTestEnv();
    const ctx = await env.context();
    await createSkill(ctx, "pdf", "Use when reading PDFs");
    await createSkill(ctx, "git", "Git helpers");
    const results = await lintLibrary(ctx);
    expect(results.map((result) => [result.skill, result.issues.length])).toEqual([
      ["git", 1],
      ["pdf", 0],
    ]);
    expect((await lintLibrary(ctx, ["pdf"])).map((result) => result.skill)).toEqual(["pdf"]);
    const file = join(env.shelfHome, "library/pdf/SKILL.md");
    expect(await readFile(file, "utf8")).toContain("name: pdf");
  });
});
