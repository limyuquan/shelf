import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createSkill } from "../src/services/library.ts";
import { borrow } from "../src/services/loans.ts";
import { initProject } from "../src/services/project.ts";
import { projectSignals, suggestSkills } from "../src/services/suggest.ts";
import { createTestEnv } from "./helpers.ts";

/** Writes files (relative path → content) into a directory; a trailing `/` makes a folder. */
async function writeTree(root: string, files: Record<string, string>): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    const target = join(root, path);
    if (path.endsWith("/")) {
      await mkdir(target, { recursive: true });
      continue;
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
}

/** A project with the given files and a library of `name → description` skills. */
async function setup(files: Record<string, string>, skills: Record<string, string>) {
  const env = await createTestEnv();
  await writeTree(env.projectDir, files);
  const ctx = await env.context();
  for (const [name, description] of Object.entries(skills)) {
    await createSkill(ctx, name, description);
  }
  const { project } = await initProject(ctx);
  return { env, ctx, project };
}

const pkg = (deps: Record<string, string>, devDeps: Record<string, string> = {}) =>
  JSON.stringify({ dependencies: deps, devDependencies: devDeps });

const terms = async (root: string) => [...new Set((await projectSignals(root)).map((s) => s.term))];

describe("project signals", () => {
  test("package.json dependencies: scopes stripped, full names kept, stoplist left out", async () => {
    const env = await createTestEnv();
    await writeTree(env.projectDir, {
      "package.json": pkg(
        { convex: "1", "@convex-dev/auth": "1", "drizzle-orm": "1", "react-dom": "19" },
        { "@playwright/test": "1", "@types/node": "1", typescript: "5" },
      ),
    });
    const signals = await projectSignals(env.projectDir);
    expect(signals).toContainEqual({
      term: "playwright",
      source: "package.json",
      reason: "package.json depends on @playwright/test",
      nameOnly: false,
    });
    expect(signals).toContainEqual(
      expect.objectContaining({ term: "drizzle", nameOnly: true, source: "package.json" }),
    );
    expect(await terms(env.projectDir)).toEqual([
      "convex",
      "@convex-dev/auth",
      "drizzle-orm",
      "drizzle",
      "@playwright/test",
      "playwright",
    ]);
  });

  test("Python, Rust and Go manifests", async () => {
    const env = await createTestEnv();
    await writeTree(env.projectDir, {
      "pyproject.toml": [
        "[project]",
        'dependencies = ["FastAPI[all]>=0.110", "sqlalchemy ; python_version > \'3.9\'"]',
        "[tool.poetry.dependencies]",
        'python = "^3.12"',
        'celery = "5"',
      ].join("\n"),
      "worker/requirements-dev.txt": "# tools\npytest==8\n-r requirements.txt\nredis>=5 # cache\n",
      "engine/Cargo.toml": '[dependencies]\ntokio = "1"\n[dev-dependencies]\ncriterion = "0.5"\n',
      "cmd/go.mod":
        "module x\n\nrequire (\n\tgithub.com/jackc/pgx/v5 v5.0.0\n)\nrequire gorm.io/gorm v1\n",
    });
    const found = await terms(env.projectDir);
    for (const term of ["fastapi", "sqlalchemy", "celery", "pytest", "redis", "python"]) {
      expect(found).toContain(term);
    }
    for (const term of ["tokio", "criterion", "rust", "pgx", "gorm", "go"]) {
      expect(found).toContain(term);
    }
    expect(found).not.toContain("pip");
    const signals = await projectSignals(env.projectDir);
    expect(signals).toContainEqual(
      expect.objectContaining({
        term: "redis",
        reason: "worker/requirements-dev.txt depends on redis",
      }),
    );
  });

  test("well-known files and folders, at the root and in workspace packages", async () => {
    const env = await createTestEnv();
    await writeTree(env.projectDir, {
      "playwright.config.ts": "",
      "convex/": "",
      Dockerfile: "",
      ".github/workflows/ci.yml": "",
      "prisma/schema.prisma": "",
      "migrations/": "",
      "packages/web/next.config.mjs": "",
      "packages/web/tailwind.config.js": "",
      "node_modules/pkg/package.json": pkg({ convex: "1" }),
      "prisma-less/prisma/": "",
    });
    const signals = await projectSignals(env.projectDir);
    const reasons = signals.map((signal) => signal.reason);
    expect(reasons).toEqual(
      expect.arrayContaining([
        "has playwright.config.ts",
        "has convex/",
        "has Dockerfile",
        "has .github/workflows/",
        "has prisma/schema.prisma",
        "has migrations/",
        "has packages/web/next.config.mjs",
        "has packages/web/tailwind.config.js",
      ]),
    );
    expect(await terms(env.projectDir)).toEqual(
      expect.arrayContaining([
        "playwright",
        "convex",
        "docker",
        "github-actions",
        "prisma",
        "next",
      ]),
    );
    expect(signals.some((signal) => signal.source.startsWith("node_modules"))).toBe(false);
    expect(signals.some((signal) => signal.source.startsWith("prisma-less"))).toBe(false);
  });

  test("ignores broken manifests and missing projects", async () => {
    const env = await createTestEnv();
    await writeTree(env.projectDir, { "package.json": "{ not json", "Cargo.toml": "[[[" });
    expect(await terms(env.projectDir)).toEqual(["rust"]);
    expect(await projectSignals(join(env.root, "nowhere"))).toEqual([]);
  });
});

describe("suggestSkills", () => {
  const library = {
    convex: "Convex backend: queries, mutations and schema",
    "playwright-e2e": "End-to-end browser tests",
    "db-migrations": "Writing safe Postgres migrations with drizzle or prisma",
    "drizzle-tips": "ORM patterns",
    "typescript-style": "House style for TypeScript code",
    "pdf-tools": "Fill and merge PDFs",
    "github-ci": "Fix failing GitHub Actions workflows",
  };

  test("ranks name matches above description matches, then by name", async () => {
    const { ctx, project } = await setup(
      {
        "package.json": pkg(
          { convex: "1", "drizzle-orm": "1" },
          { "@playwright/test": "1", typescript: "5" },
        ),
        "convex/": "",
        ".github/workflows/ci.yml": "",
        "prisma/schema.prisma": "",
      },
      library,
    );
    const suggestions = await suggestSkills(ctx, project);
    expect(suggestions.map((s) => [s.skill, s.score])).toEqual([
      ["convex", 10],
      ["drizzle-tips", 10],
      ["playwright-e2e", 10],
      ["db-migrations", 3],
      ["github-ci", 3],
    ]);
    expect(suggestions[0]).toEqual({
      skill: "convex",
      description: library.convex,
      score: 10,
      reasons: ["package.json depends on convex", "has convex/"],
      descriptionTokens: Math.ceil(`convex${library.convex}`.length / 4),
    });
    expect(suggestions.find((s) => s.skill === "playwright-e2e")?.reasons).toEqual([
      "package.json depends on @playwright/test",
    ]);
    // `typescript` is on the stoplist; `drizzle` alone only matches names.
    expect(suggestions.map((s) => s.skill)).not.toContain("typescript-style");
    expect(suggestions.find((s) => s.skill === "db-migrations")?.reasons).toEqual([
      "has prisma/schema.prisma",
    ]);
  });

  test("leaves out skills the project already borrows and honours the limit", async () => {
    const { ctx, project } = await setup(
      { "package.json": pkg({ convex: "1" }, { "@playwright/test": "1" }), "migrations/": "" },
      library,
    );
    await borrow(ctx, ["convex"]);
    const suggestions = await suggestSkills(ctx, project);
    expect(suggestions.map((s) => s.skill)).toEqual(["db-migrations", "playwright-e2e"]);
    expect((await suggestSkills(ctx, project, { limit: 1 })).map((s) => s.skill)).toEqual([
      "db-migrations",
    ]);
  });

  test("suggests nothing for a project without signals", async () => {
    const { ctx, project } = await setup({ "README.md": "hello" }, library);
    expect(await suggestSkills(ctx, project)).toEqual([]);
  });
});
