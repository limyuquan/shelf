/**
 * Builds a demo shelf (a library with history, six projects, loans in every
 * state, two months of activity from several agents) for developing and
 * screenshotting the dashboard without touching the real ~/.shelf.
 *
 * Dates are relative to now and land at fixed times of day, so re-seeding gives
 * the same pictures.
 *
 * Usage: bun scripts/demo/seed.ts [dir] [--hooks]   (default: $TMPDIR/shelf-demo)
 */
import { appendFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  addSkill,
  borrow,
  type Clock,
  type Context,
  closeContext,
  createContext,
  initProject,
  keep,
  promote,
  refreshLibrary,
  renew,
  saveSet,
  setSkillLoanDays,
  setup,
  sync,
  update,
  used,
} from "@shelf/core";
import { DEMO_SKILLS, type DemoSkill, renderSkill } from "./skills.ts";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export interface Demo {
  readonly root: string;
  readonly env: { HOME: string; SHELF_HOME: string };
}

export interface SeedOptions {
  /**
   * Install shelf's hooks for Claude Code and Codex. Off by default, so the
   * dashboard shows its missing-hooks warning while developing.
   */
  readonly hooks?: boolean;
}

/**
 * When something happened: a number of days ago (under 1 counts back from now,
 * e.g. 0.05 is 72 minutes ago), or `[daysAgo, hour]` for a time of day.
 */
type When = number | readonly [days: number, hour: number];

function timeOf(when: When): Date {
  const [days, hour] = typeof when === "number" ? [when, 10] : when;
  if (days < 1) return new Date(Date.now() - days * DAY);
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return new Date(date.getTime() + hour * HOUR);
}

/** A small deterministic hash, to spread work sessions over the day. */
function hash(text: string): number {
  let h = 2166136261;
  for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}

export async function seedDemo(
  root = join(tmpdir(), "shelf-demo"),
  options: SeedOptions = {},
): Promise<Demo> {
  await rm(root, { recursive: true, force: true });
  const env = { HOME: root, SHELF_HOME: join(root, ".shelf") };
  const project = (name: string) => join(root, "code", name);
  const library = (...path: string[]) => join(env.SHELF_HOME, "library", ...path);

  /** Runs `fn` as `actor` in `cwd` with the clock at `when`. */
  async function as(
    actor: string,
    when: When,
    cwd: string,
    fn: (ctx: Context) => Promise<unknown>,
  ): Promise<void> {
    const at = timeOf(when);
    const clock: Clock = { now: () => at };
    const ctx = await createContext({ cwd, env, clock, actor });
    try {
      await fn(ctx);
    } finally {
      closeContext(ctx);
    }
  }

  // Everything below is planned first and run in time order, so each loan sees
  // its library revisions, uses and edits in the order they happened.
  const plan: { at: Date; order: number; run: () => Promise<unknown> }[] = [];
  const step = (when: When, actor: string, cwd: string, fn: (ctx: Context) => Promise<unknown>) => {
    plan.push({ at: timeOf(when), order: plan.length, run: () => as(actor, when, cwd, fn) });
  };
  /** A change to files on disk at `when`, outside any shelf command. */
  const edit = (when: When, fn: () => Promise<unknown>) => {
    plan.push({ at: timeOf(when), order: plan.length, run: fn });
  };

  const skill = (name: string): DemoSkill => {
    const found = DEMO_SKILLS.find((candidate) => candidate.name === name);
    if (!found) throw new Error(`No demo skill ${name}`);
    return found;
  };
  /** Writes skills into the library folder, as if by hand; the refresh records them. */
  const writeSkills = async (names: string[]) => {
    for (const name of names) {
      const { files = {}, ...rest } = skill(name);
      await mkdir(library(name), { recursive: true });
      await writeFile(library(name, "SKILL.md"), renderSkill(rest));
      for (const [path, content] of Object.entries(files)) {
        await mkdir(dirname(library(name, path)), { recursive: true });
        await writeFile(library(name, path), content);
      }
    }
  };
  const addToLibrary = (when: When, names: string[]) =>
    step(when, "user", root, async (ctx) => {
      await writeSkills(names);
      await refreshLibrary(ctx);
    });
  /** A library edit: appends `text` to a skill's SKILL.md. */
  const revise = (when: When, name: string, text: string, actor = "user") =>
    step(when, actor, root, async (ctx) => {
      await appendFile(library(name, "SKILL.md"), text);
      await refreshLibrary(ctx);
    });
  /** A local edit to a project's copy of a borrowed skill. */
  const editCopy = (when: When, name: string, skillName: string, text: string) =>
    edit(when, async () => {
      for (const dir of [".agents/skills", ".claude/skills"]) {
        await appendFile(join(project(name), dir, skillName, "SKILL.md"), text);
      }
    });

  /**
   * Agents using a skill on the given days. Each project works in a few sessions
   * a day; skills used in the same session are a minute apart, so the timeline
   * shows them together.
   */
  const uses = (actor: string, name: string, skillName: string, days: number[]) => {
    for (const day of days) {
      let when: When = day;
      if (day >= 1) {
        const session = hash(`${name}:${day}:${skillName}`) % 3;
        const start = [9.4, 13.7, 16.2][session] as number;
        const offset = (hash(`${name}:${day}`) % 50) / 60;
        when = [day, start + offset + (hash(skillName) % 40) / 3600];
      }
      step(when, actor, project(name), (ctx) => used(ctx, [skillName]));
    }
  };

  // The library, built up over two months.
  addToLibrary(
    [60, 10],
    ["react-best-practices", "git-hygiene", "code-review", "api-design", "sql-migrations"],
  );
  addToLibrary([58, 15], ["playwright-testing", "accessibility-audit", "release-notes"]);
  addToLibrary([52, 11], ["pdf-tools", "writing-docs", "docker-builds"]);
  addToLibrary([47, 14], ["tailwind-patterns", "postgres-performance"]);
  addToLibrary([44, 10], ["python-packaging", "pytest-patterns"]);
  addToLibrary([40, 17], ["react-native-performance", "incident-postmortem"]);

  // A skill imported from a folder of shared skills that has since moved on.
  const upstream = join(root, "src", "agent-skills", "commit-messages");
  const commitSkill = (rules: string[]) =>
    `---\nname: commit-messages\ndescription: Write conventional commit messages that explain why, not what. Use when writing or reviewing a commit message.\n---\n\n# Commit messages\n\nFormat: \`type(scope): subject\`, e.g. \`fix(billing): round tax per line\`.\n\n${rules.map((rule) => `- ${rule}`).join("\n")}\n`;
  edit([50, 9], async () => {
    await mkdir(upstream, { recursive: true });
    await writeFile(
      join(upstream, "SKILL.md"),
      commitSkill(["Use the imperative mood", "Keep the subject under 72 characters"]),
    );
  });
  step([50, 9.5], "user", root, (ctx) => addSkill(ctx, upstream, { yes: true }));

  // react-best-practices keeps improving, so its revisions tell a story.
  revise(
    [41, 11],
    "react-best-practices",
    "\n## Rendering\n\n- Give list items stable keys from the data, never the array index.\n- Split a slow subtree out before memoising it.\n",
  );
  revise(
    [27, 16],
    "react-best-practices",
    '\n## Server Components\n\n- Fetch data in Server Components; add `"use client"` only where state or effects are needed.\n- Pass serialisable props across the boundary.\n',
  );
  revise(
    [13, 10],
    "react-best-practices",
    "\n## React Compiler\n\n- Let the compiler memoise. Remove manual `useMemo` and `useCallback` unless a profile shows they help.\n",
  );
  revise(
    [6, 15],
    "react-best-practices",
    "\n## Forms\n\n- Use form actions and `useActionState` for submissions; show pending state with `useFormStatus`.\n",
  );
  revise(
    [3, 11],
    "code-review",
    "\n## Large changes\n\n- Ask for a split when a diff passes ~400 lines.\n- Review the design first, the details second.\n",
  );

  // Sets: skills borrowed together.
  step([38, 12], "user", root, async (ctx) => {
    await saveSet(ctx, "frontend", {
      description: "UI work in React apps",
      skills: ["react-best-practices", "playwright-testing", "accessibility-audit"],
    });
    await saveSet(ctx, "backend", {
      description: "HTTP services on Postgres",
      skills: ["api-design", "sql-migrations", "postgres-performance", "git-hygiene"],
    });
  });
  step([30, 18], "user", root, (ctx) =>
    saveSet(ctx, "python", {
      description: "Python services and workers",
      skills: ["python-packaging", "pytest-patterns", "docker-builds"],
    }),
  );

  // storefront: the busiest project, mostly Claude Code.
  step([34, 9.2], "agent:claude-code", project("storefront"), async (ctx) => {
    await initProject(ctx);
    await borrow(ctx, ["@frontend"]);
  });
  step([22, 11], "agent:claude-code", project("storefront"), (ctx) =>
    borrow(ctx, ["tailwind-patterns"]),
  );
  // A fix found while testing, published back to the library.
  editCopy(
    [12, 15],
    "storefront",
    "playwright-testing",
    "- Stub third-party scripts (analytics, chat) with `page.route` so they can't slow a test.\n",
  );
  step([12, 15.2], "agent:claude-code", project("storefront"), (ctx) =>
    promote(ctx, "playwright-testing"),
  );
  step([5, 10.1], "agent:claude-code", project("storefront"), (ctx) =>
    update(ctx, ["react-best-practices"]),
  );
  step(0.18, "agent:claude-code", project("storefront"), (ctx) =>
    borrow(ctx, ["postgres-performance"]),
  );
  uses(
    "agent:claude-code",
    "storefront",
    "react-best-practices",
    [33, 30, 29, 28, 23, 22, 21, 20, 16, 15, 14, 13, 9, 8, 7, 2, 1, 0.05],
  );
  uses("agent:claude-code", "storefront", "playwright-testing", [33, 27, 22, 20, 15, 9, 8, 2, 1]);
  uses("agent:claude-code", "storefront", "accessibility-audit", [33, 26]);
  uses("agent:claude-code", "storefront", "tailwind-patterns", [21, 16, 14, 13, 8, 6, 3, 0.2]);
  uses("agent:claude-code", "storefront", "postgres-performance", [0.17]);
  // A library improvement, picked up the next day.
  revise([2, 10.5], "tailwind-patterns", "- Prefer `size-*` to matching `w-*` and `h-*` pairs.\n");
  step([1, 15.1], "agent:claude-code", project("storefront"), (ctx) =>
    update(ctx, ["tailwind-patterns"]),
  );

  // billing-api: Codex, every day. Its API skill is kept for good, one copy has
  // local edits, and a skill nobody used was returned.
  step([46, 9.1], "agent:codex", project("billing-api"), async (ctx) => {
    await initProject(ctx);
    await borrow(ctx, ["docker-builds"]);
  });
  step([14, 9], "agent:codex", project("billing-api"), (ctx) => sync(ctx));
  step([28, 10], "agent:codex", project("billing-api"), (ctx) =>
    borrow(ctx, ["api-design", "sql-migrations", "git-hygiene", "code-review", "release-notes"]),
  );
  step([27, 16.5], "user", project("billing-api"), (ctx) =>
    keep(ctx, ["api-design"], { keep: true, reason: "every endpoint follows it" }),
  );
  // Migrations are rare, so that skill gets longer loans everywhere.
  step([26, 12], "user", root, (ctx) => setSkillLoanDays(ctx, "sql-migrations", 60));
  step([9, 9.1], "agent:codex", project("billing-api"), (ctx) =>
    borrow(ctx, ["postgres-performance"]),
  );
  editCopy(
    [15, 17],
    "billing-api",
    "git-hygiene",
    "\n## Before merging\n\n- Squash fixup commits.\n- Keep the migration and the code that needs it in one commit.\n",
  );
  uses(
    "agent:codex",
    "billing-api",
    "api-design",
    [27, 26, 23, 22, 21, 20, 16, 15, 14, 13, 12, 9, 8, 7, 6, 5, 2, 1, 0.02],
  );
  uses("agent:codex", "billing-api", "sql-migrations", [22, 9, 5]);
  uses("agent:codex", "billing-api", "git-hygiene", [27, 20, 13, 6]);
  uses("agent:codex", "billing-api", "release-notes", [25]);
  uses("agent:codex", "billing-api", "code-review", [27, 21, 14, 7, 2]);
  uses("agent:codex", "billing-api", "postgres-performance", [9, 8, 4, 1]);

  // mobile-app: borrowed before the library improved react-best-practices. An
  // audit skill nobody used there went back yesterday.
  step([35, 11], "agent:claude-code", project("mobile-app"), async (ctx) => {
    await initProject(ctx);
    await borrow(ctx, ["accessibility-audit"]);
  });
  step([20, 9.6], "agent:claude-code", project("mobile-app"), (ctx) =>
    borrow(ctx, ["react-best-practices", "react-native-performance", "release-notes"]),
  );
  step([1, 9.2], "agent:claude-code", project("mobile-app"), (ctx) => sync(ctx));
  step(0.45, "agent:claude-code", project("mobile-app"), (ctx) =>
    renew(ctx, "release-notes", { reason: "release 2.4 notes are due Friday" }),
  );
  uses("agent:claude-code", "mobile-app", "react-best-practices", [19, 15, 12, 8, 5, 1]);
  uses("agent:cursor", "mobile-app", "react-native-performance", [18, 11, 10, 4, 3, 0.15]);
  uses("agent:claude-code", "mobile-app", "release-notes", [16, 9]);

  // docs-site: an old loan kept past its due date because it has local edits.
  step([44, 14], "agent:codex", project("docs-site"), async (ctx) => {
    await initProject(ctx);
    await borrow(ctx, ["pdf-tools", "release-notes"]);
  });
  step([25, 10.4], "agent:codex", project("docs-site"), (ctx) => borrow(ctx, ["writing-docs"]));
  editCopy(
    [33, 15],
    "docs-site",
    "pdf-tools",
    "\n## Manuals\n\n- Keep page numbers in extracted text so answers can cite them.\n",
  );
  uses("agent:codex", "docs-site", "pdf-tools", [43, 34]);
  uses("agent:codex", "docs-site", "release-notes", [33, 31, 16, 2]);
  uses("agent:codex", "docs-site", "writing-docs", [24, 22, 17, 10, 3, 0.1]);

  // design-system: Cursor. Every component must pass an audit, so that loan is kept.
  step([33, 11], "agent:cursor", project("design-system"), async (ctx) => {
    await initProject(ctx);
    await borrow(ctx, ["tailwind-patterns"]);
  });
  step([10, 14], "agent:cursor", project("design-system"), (ctx) =>
    borrow(ctx, ["accessibility-audit", "react-best-practices", "playwright-testing"]),
  );
  step([9, 9.3], "user:dashboard", project("design-system"), (ctx) =>
    keep(ctx, ["accessibility-audit"], { keep: true }),
  );
  uses("agent:cursor", "design-system", "tailwind-patterns", [32, 27]);
  uses("agent:cursor", "design-system", "accessibility-audit", [9, 8, 6, 2, 0.3]);
  uses("agent:cursor", "design-system", "react-best-practices", [9, 7, 4]);
  uses("agent:cursor", "design-system", "playwright-testing", [9, 7, 3, 2]);

  // ingest-worker: a Python service. One loan renewed by hand, one copy edited.
  step([40, 10], "agent:codex", project("ingest-worker"), async (ctx) => {
    await initProject(ctx);
    await borrow(ctx, ["commit-messages"]);
  });
  step([18, 13], "agent:codex", project("ingest-worker"), (ctx) => borrow(ctx, ["@python"]));
  step([10, 16.6], "agent:codex", project("ingest-worker"), (ctx) =>
    renew(ctx, "commit-messages", {
      reason: "CI writes commits where hooks don't run; still in use",
    }),
  );
  editCopy(
    [10, 16],
    "ingest-worker",
    "docker-builds",
    "\n## This project\n\n- The worker image needs `libpq`; install it in the runtime stage only.\n",
  );
  uses("agent:codex", "ingest-worker", "commit-messages", [38]);
  uses("agent:codex", "ingest-worker", "python-packaging", [17, 16, 11, 4]);
  uses("agent:codex", "ingest-worker", "pytest-patterns", [17, 15, 14, 10, 9, 8, 3, 1, 0.4]);
  uses("agent:codex", "ingest-worker", "docker-builds", [16, 10]);

  // A library edit this morning.
  revise(
    0.25,
    "incident-postmortem",
    "\nShare the draft with everyone involved before publishing it.\n",
  );

  for (const name of [
    "storefront",
    "billing-api",
    "mobile-app",
    "docs-site",
    "design-system",
    "ingest-worker",
  ]) {
    await mkdir(join(project(name), ".git"), { recursive: true });
  }
  plan.sort((a, b) => a.at.getTime() - b.at.getTime() || a.order - b.order);
  for (const { run } of plan) await run();

  // The upstream folder moved on after the import: the skill page offers the update.
  await writeFile(
    join(upstream, "SKILL.md"),
    commitSkill([
      "Use the imperative mood",
      "Keep the subject under 50 characters",
      "Explain why in the body; the diff shows what",
    ]),
  );

  // Harness folders, and shelf's hooks in them when asked for.
  await mkdir(join(root, ".claude"), { recursive: true });
  const bundled = await readFile(join(import.meta.dir, "../../packages/skill/SKILL.md"), "utf8");
  if (options.hooks) {
    await mkdir(join(root, ".codex"), { recursive: true });
    await as("user", 0.5, root, (ctx) =>
      setup(ctx, { bundledSkill: bundled, hookCommand: "shelf" }),
    );
  }

  // User-level skills, which load in every project: shelf's own and two others.
  for (const dir of [".claude/skills", ".agents/skills"]) {
    await mkdir(join(root, dir, "shelf"), { recursive: true });
    await writeFile(join(root, dir, "shelf", "SKILL.md"), bundled);
  }
  const globalSkill = (dir: string, name: string, description: string, body: string) =>
    writeSkillFolder(
      join(root, dir, name),
      `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`,
    );
  await globalSkill(
    ".claude/skills",
    "frontend-design",
    "Create distinctive, production-grade frontend interfaces with high design quality. Use when building web components, pages or applications, and when styling or beautifying any web UI.",
    `# Frontend design

Pick a clear aesthetic direction before writing any code, and commit to it.

## Process

1. Name the purpose, the audience and one thing the page must make obvious.
2. Choose a type pairing, a palette of three to five colours and a spacing scale.
3. Sketch the layout at phone and desktop widths before styling details.
4. Build with semantic HTML first, then layer style and motion.

## Typography

- One display face for headings, one text face for everything else.
- Set body text at 16-18 px with a line height of 1.5.
- Limit lines to 60-75 characters.

## Colour

- Define colours as tokens; never hard-code hex values in components.
- Check contrast for text and icons in both light and dark themes.

## Motion

- Animate opacity and transform only.
- Keep transitions under 250 ms and respect \`prefers-reduced-motion\`.

## Review

- Compare the result with the direction you chose; remove anything that fights it.
- Test with real content, including long names and empty states.
`,
  );
  await globalSkill(
    ".agents/skills",
    "web-research",
    "Research a question on the web, cross-check sources and cite them. Use when a task needs facts that may have changed since training.",
    `# Web research

1. Search for primary sources first: official docs, specifications, release notes.
2. Cross-check every claim that matters against a second source.
3. Note the date of each source; prefer the newest for fast-moving topics.
4. Cite sources inline with their URLs.
`,
  );

  // Projects that don't use shelf yet, with hand-copied skills for Find existing
  // skills: two versions of brand-voice, and a copy identical to the library's.
  const handCopy = (dir: string, name: string, description: string, rules: string[]) =>
    writeSkillFolder(
      dir,
      `---\nname: ${name}\ndescription: ${description}\n---\n\n${rules.map((rule) => `- ${rule}`).join("\n")}\n`,
    );
  const brandVoice =
    "Write product copy in the house voice, plain and specific with no hype. Use when writing UI text, emails or landing pages.";
  for (const name of ["marketing-site", "analytics"]) {
    await mkdir(join(project(name), ".git"), { recursive: true });
  }
  await handCopy(
    join(project("marketing-site"), ".claude/skills/brand-voice"),
    "brand-voice",
    brandVoice,
    ["Lead with what the reader can do", "Prefer numbers to adjectives", "No exclamation marks"],
  );
  for (const target of [".claude/skills", ".agents/skills"]) {
    await handCopy(join(project("analytics"), target, "brand-voice"), "brand-voice", brandVoice, [
      "Lead with what the reader can do",
      "Prefer numbers to adjectives",
    ]);
  }
  await handCopy(
    join(project("marketing-site"), ".claude/skills/seo-checklist"),
    "seo-checklist",
    "Check titles, descriptions, headings and structured data before publishing a page. Use when a page is about to go live.",
    ["One h1 per page", "Titles under 60 characters", "Describe every image"],
  );
  await cp(library("api-design"), join(project("analytics"), ".claude/skills/api-design"), {
    recursive: true,
  });

  // What the projects are built with, so project pages suggest skills they lack.
  const manifest = (name: string, dependencies: string[], devDependencies: string[] = []) =>
    writeFile(
      join(project(name), "package.json"),
      JSON.stringify({
        name,
        dependencies: Object.fromEntries(dependencies.map((dep) => [dep, "*"])),
        devDependencies: Object.fromEntries(devDependencies.map((dep) => [dep, "*"])),
      }),
    );
  await manifest(
    "storefront",
    ["next", "react", "react-dom", "@prisma/client"],
    ["@playwright/test", "tailwindcss", "typescript"],
  );
  await mkdir(join(project("storefront"), "migrations"), { recursive: true });
  await writeFile(join(project("storefront"), "Dockerfile"), "FROM node:22-slim\n");
  await manifest("billing-api", ["hono", "pg", "pdf-lib", "zod"], ["vitest", "typescript"]);
  await mkdir(join(project("billing-api"), "migrations"), { recursive: true });
  await writeFile(join(project("billing-api"), "Dockerfile"), "FROM oven/bun:1\n");
  await manifest("mobile-app", ["expo", "react", "react-native"], ["typescript"]);
  await manifest("docs-site", ["next", "react", "react-dom"], ["tailwindcss"]);
  await writeFile(join(project("docs-site"), "playwright.config.ts"), "export default {};\n");
  await manifest("design-system", ["react", "react-dom"], ["@playwright/test", "tailwindcss"]);
  await writeFile(
    join(project("ingest-worker"), "pyproject.toml"),
    '[project]\nname = "ingest-worker"\ndependencies = ["httpx", "psycopg", "pydantic"]\n\n[dependency-groups]\ndev = ["pytest"]\n',
  );
  await writeFile(join(project("ingest-worker"), "Dockerfile"), "FROM python:3.13-slim\n");

  return { root, env };
}

async function writeSkillFolder(dir: string, content: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "SKILL.md"), content);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const demo = await seedDemo(
    args.find((arg) => !arg.startsWith("--")),
    { hooks: args.includes("--hooks") },
  );
  console.log(`Demo shelf created in ${demo.root}`);
  console.log(`SHELF_HOME=${demo.env.SHELF_HOME} HOME=${demo.env.HOME}`);
}
