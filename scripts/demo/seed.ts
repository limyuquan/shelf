/**
 * Builds a demo shelf (library, projects, loans in every state, activity from
 * several agents) for developing and screenshotting the dashboard without
 * touching the real ~/.shelf.
 *
 * Usage: bun scripts/demo/seed.ts [dir]   (default: $TMPDIR/shelf-demo)
 */
import { appendFile, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
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
