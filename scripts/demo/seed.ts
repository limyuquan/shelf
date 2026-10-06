/**
 * Builds a demo shelf (library, projects, loans in every state, activity from
 * several agents) for developing and screenshotting the dashboard without
 * touching the real ~/.shelf.
 *
 * Usage: bun scripts/demo/seed.ts [dir]   (default: $TMPDIR/shelf-demo)
 */
import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  addSkill,
  borrow,
  type Clock,
  type Context,
  closeContext,
  createContext,
  createSkill,
  initProject,
  refreshLibrary,
  update,
  used,
} from "@shelf/core";
import { DEMO_SKILLS, renderSkill } from "./skills.ts";

const DAY = 24 * 60 * 60 * 1000;

export interface Demo {
  readonly root: string;
  readonly env: { HOME: string; SHELF_HOME: string };
}

export async function seedDemo(root = join(tmpdir(), "shelf-demo")): Promise<Demo> {
  await rm(root, { recursive: true, force: true });
  const env = { HOME: root, SHELF_HOME: join(root, ".shelf") };
  const project = (name: string) => join(root, "code", name);

  /** Runs `fn` as `actor` in `cwd`, with the clock set `daysAgo` days back. */
  async function as(
    actor: string,
    daysAgo: number,
    cwd: string,
    fn: (ctx: Context) => Promise<unknown>,
  ): Promise<void> {
    const clock: Clock = { now: () => new Date(Date.now() - daysAgo * DAY) };
    const ctx = await createContext({ cwd, env, clock, actor });
    try {
      await fn(ctx);
    } finally {
      closeContext(ctx);
    }
  }

  for (const name of ["storefront", "billing-api", "mobile-app", "docs-site"]) {
    await mkdir(join(project(name), ".git"), { recursive: true });
  }

  // The library, built up over the last six weeks.
  await as("user", 42, root, async (ctx) => {
    for (const skill of DEMO_SKILLS) {
      await createSkill(ctx, skill.name, skill.description);
      await writeFile(join(env.SHELF_HOME, "library", skill.name, "SKILL.md"), renderSkill(skill));
    }
    await refreshLibrary(ctx);
  });

  // Reference files, shown as tabs on the skill page.
  await as("user", 40, root, async (ctx) => {
    const references = join(env.SHELF_HOME, "library/api-design/references");
    await mkdir(references, { recursive: true });
    await writeFile(
      join(references, "errors.md"),
      '# Error envelope\n\n```json\n{ "error": { "code": "NOT_FOUND", "message": "…" } }\n```\n',
    );
    await writeFile(
      join(references, "pagination.md"),
      "# Cursor pagination\n\n- Opaque cursors\n- `limit` capped at 100\n",
    );
    await refreshLibrary(ctx);
  });

  // A skill imported from an upstream source that has since moved on.
  const upstream = join(root, "upstream", "commit-messages");
  await mkdir(upstream, { recursive: true });
  const commitSkill = (rules: string[]) =>
    `---\nname: commit-messages\ndescription: Write conventional commit messages that explain why, not what.\n---\n\n# Commit messages\n\n${rules.map((rule) => `- ${rule}`).join("\n")}\n`;
  await writeFile(
    join(upstream, "SKILL.md"),
    commitSkill(["Use the imperative mood", "Keep the subject under 72 characters"]),
  );
  await as("user", 30, root, (ctx) => addSkill(ctx, upstream, { yes: true }));
  await writeFile(
    join(upstream, "SKILL.md"),
    commitSkill([
      "Use the imperative mood",
      "Keep the subject under 50 characters",
      "Explain why in the body; the diff shows what",
    ]),
  );

  // A Claude Code install without shelf's hooks, so the dashboard warns about it.
  await mkdir(join(root, ".claude"), { recursive: true });

  // storefront: actively used; two loans going stale.
  await as("agent:claude-code", 26, project("storefront"), async (ctx) => {
    await initProject(ctx);
    await borrow(ctx, ["react-best-practices", "playwright-testing", "accessibility-audit"]);
  });
  await as("agent:claude-code", 24, project("storefront"), (ctx) => borrow(ctx, ["git-hygiene"]));
  await as("agent:claude-code", 3, project("storefront"), (ctx) =>
    used(ctx, ["playwright-testing"]),
  );

  // billing-api: in daily use, one copy edited locally.
  await as("agent:codex", 12, project("billing-api"), async (ctx) => {
    await initProject(ctx);
    await borrow(ctx, ["api-design", "sql-migrations", "git-hygiene", "release-notes"]);
  });
  await as("agent:codex", 5, project("billing-api"), (ctx) => used(ctx, ["sql-migrations"]));
  await appendFile(
    join(project("billing-api"), ".agents/skills/git-hygiene/SKILL.md"),
    "\n- Squash fixup commits before merging\n",
  );

  // mobile-app: borrowed before the library improved react-best-practices.
  await as("agent:claude-code", 15, project("mobile-app"), async (ctx) => {
    await initProject(ctx);
    await borrow(ctx, ["react-best-practices", "release-notes"]);
  });
  await as("user", 6, root, async (ctx) => {
    await appendFile(
      join(env.SHELF_HOME, "library/react-best-practices/SKILL.md"),
      "\n## React Compiler\n\n- Let the compiler memoise; remove manual useMemo/useCallback\n",
    );
    await refreshLibrary(ctx);
  });
  await as("agent:claude-code", 5, project("storefront"), (ctx) =>
    update(ctx, ["react-best-practices"]),
  );

  // docs-site: an old loan kept past its due date because it has local edits.
  await as("agent:codex", 36, project("docs-site"), async (ctx) => {
    await initProject(ctx);
    await borrow(ctx, ["pdf-tools", "release-notes"]);
  });
  await appendFile(
    join(project("docs-site"), ".agents/skills/pdf-tools/SKILL.md"),
    "\n- Prefer pdftotext for scanned manuals\n",
  );

  // A month of use, oldest first (a use older than a loan's last one is ignored),
  // so Insights has a usage history. git-hygiene and commit-messages stay unused.
  const history: [string, string, string, number[]][] = [
    ["agent:codex", "docs-site", "pdf-tools", [34]],
    ["agent:codex", "docs-site", "release-notes", [33, 31, 16]],
    ["agent:claude-code", "storefront", "react-best-practices", [22, 20, 19, 15, 13, 8, 7, 4, 2]],
    ["agent:claude-code", "storefront", "accessibility-audit", [21, 18]],
    ["agent:claude-code", "storefront", "playwright-testing", [2, 1]],
    ["agent:claude-code", "mobile-app", "react-best-practices", [14, 9, 2]],
    ["agent:codex", "billing-api", "api-design", [11, 10, 9, 7, 6, 5, 3, 2, 1]],
    ["agent:codex", "billing-api", "release-notes", [9]],
    ["agent:codex", "billing-api", "sql-migrations", [4, 2]],
  ];
  for (const [actor, name, skill, days] of history) {
    for (const daysAgo of days) {
      await as(actor, daysAgo, project(name), (ctx) => used(ctx, [skill]));
    }
  }

  // User-level skills, which load in every project: shelf's own and two others.
  const bundled = await readFile(join(import.meta.dir, "../../packages/skill/SKILL.md"), "utf8");
  for (const dir of [".claude/skills", ".agents/skills"]) {
    await mkdir(join(root, dir, "shelf"), { recursive: true });
    await writeFile(join(root, dir, "shelf", "SKILL.md"), bundled);
  }
  const globalSkill = (name: string, description: string, body: string) =>
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\n${body}\n`;
  await mkdir(join(root, ".claude/skills/frontend-design"), { recursive: true });
  await writeFile(
    join(root, ".claude/skills/frontend-design/SKILL.md"),
    globalSkill(
      "frontend-design",
      "Create distinctive, production-grade frontend interfaces with high design quality. Use when building web components, pages or applications, and when styling or beautifying any web UI.",
      "- Pick a clear aesthetic direction before writing code\n".repeat(40),
    ),
  );
  await mkdir(join(root, ".agents/skills/web-research"), { recursive: true });
  await writeFile(
    join(root, ".agents/skills/web-research/SKILL.md"),
    globalSkill(
      "web-research",
      "Research a question on the web, cross-check sources and cite them.",
      "- Prefer primary sources\n".repeat(12),
    ),
  );

  // Recent use across projects.
  await as("agent:codex", 0.1, project("docs-site"), (ctx) => used(ctx, ["release-notes"]));
  await as("agent:claude-code", 0.05, project("storefront"), (ctx) =>
    used(ctx, ["react-best-practices"]),
  );
  await as("agent:codex", 0.02, project("billing-api"), (ctx) => used(ctx, ["api-design"]));

  return { root, env };
}

if (import.meta.main) {
  const demo = await seedDemo(process.argv[2]);
  console.log(`Demo shelf created in ${demo.root}`);
  console.log(`SHELF_HOME=${demo.env.SHELF_HOME} HOME=${demo.env.HOME}`);
}
