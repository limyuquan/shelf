/**
 * Checks the built demo in a real browser: opens every page as a deep link under
 * /shelf/demo/ at desktop and phone sizes in both themes, and fails on requests
 * the snapshot can't answer, console errors, error pages or pages stuck loading.
 * Then tries ⌘K, the library filter, a mutation (must show the read-only
 * message) and a reload.
 *
 * Usage: bun scripts/site/demo/verify.ts [--dir dist/site/demo] [--build] [--port 4242]
 *                                        [--screenshots dir]
 */
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { type Browser, chromium, type Locator, type Page } from "playwright";
import type {
  CatalogEntry,
  ProjectOverview,
  SkillPage,
} from "../../../packages/web/src/api/types.ts";
import { buildDemo, serveDemo } from "./build.ts";
import type { Snapshot } from "./client/backend.ts";

const { values } = parseArgs({
  options: {
    dir: { type: "string", default: "dist/site/demo" },
    build: { type: "boolean" },
    port: { type: "string", default: "4242" },
    screenshots: { type: "string" },
  },
});

if (values.build) await buildDemo(values.dir);
const snapshot = JSON.parse(await readFile(join(values.dir, "snapshot.json"), "utf8")) as Snapshot;
const recorded = <T>(path: string): T => {
  const entry = snapshot.responses[`GET ${path}`];
  if (!entry) throw new Error(`snapshot.json has no GET ${path}`);
  return snapshot.bodies[entry[1]] as T;
};

/** Every page of the demo, as router paths. */
function allPages(): string[] {
  const pages = [
    "/",
    "/projects",
    "/library",
    "/activity",
    "/insights",
    "/settings",
    "/find-skills",
  ];
  for (const project of recorded<ProjectOverview[]>("/api/projects")) {
    pages.push(`/projects/${project.id}`, `/projects/${project.id}?borrow=true`);
  }
  for (const { name } of recorded<CatalogEntry[]>("/api/skills")) {
    const page = recorded<SkillPage>(`/api/skills/${name}`);
    pages.push(`/library/${name}`);
    for (const file of page.detail.files.filter((path) => path !== "SKILL.md")) {
      pages.push(`/library/${name}?file=${encodeURIComponent(file)}`);
    }
    for (const revision of page.history.revisions) {
      const hex = revision.hash.replace(/^sha256:/, "");
      pages.push(
        `/library/${name}/revisions/${hex}`,
        `/library/${name}/revisions/${hex}?tab=files`,
      );
    }
  }
  return pages;
}

/** One project, one skill and one revision: enough to see every layout in each mode. */
function samplePages(pages: string[]): string[] {
  const first = (pattern: RegExp) => pages.find((page) => pattern.test(page)) ?? "/";
  return [
    ...new Set([
      "/",
      "/projects",
      first(/^\/projects\/[^/?]+$/),
      "/library",
      first(/^\/library\/[^/?]+$/),
      first(/^\/library\/[^/]+\/revisions\/[^/?]+$/),
      "/activity",
      "/insights",
      "/settings",
      "/find-skills",
    ]),
  ];
}

const server = serveDemo(values.dir, Number(values.port));
const base = `http://localhost:${server.port}/shelf/demo/`;
const problems: string[] = [];
const browser: Browser = await chromium.launch({
  args: ["--disable-gpu", "--disable-software-rasterizer", "--disable-dev-shm-usage"],
});

/** A fresh page that records console errors. */
async function open(
  viewport: { width: number; height: number },
  theme: "dark" | "light",
): Promise<{ page: Page; errors: string[] }> {
  const context = await browser.newContext({ viewport, colorScheme: theme });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return { page, errors };
}

/** Waits for the page to finish loading its data; returns what's wrong with it. */
async function settle(page: Page): Promise<string[]> {
  const issues: string[] = [];
  try {
    await page.locator("main").first().waitFor({ timeout: 20_000 });
    await page.waitForFunction(
      () => document.querySelectorAll("main .animate-pulse").length === 0,
      undefined,
      { timeout: 15_000 },
    );
  } catch {
    issues.push("still loading after 20 s");
  }
  await page.waitForTimeout(300);
  const state = await page.evaluate(() => ({
    misses: window.__shelfDemo?.misses ?? ["(demo backend never loaded)"],
    text: document.querySelector("main")?.textContent ?? "",
  }));
  for (const miss of state.misses) issues.push(`snapshot has no ${miss}`);
  if (/Nothing here|not part of the demo|Something went wrong|not valid YAML/.test(state.text)) {
    issues.push(`shows an error: ${state.text.slice(0, 120)}`);
  }
  if (state.text.trim().length < 40) issues.push("main panel is (nearly) empty");
  return issues;
}

const screenshot = async (page: Page, name: string) => {
  if (!values.screenshots) return;
  await mkdir(values.screenshots, { recursive: true });
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.screenshot({ path: join(values.screenshots, `${name}.png`), timeout: 60_000 });
      return;
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
};

const slug = (path: string) =>
  path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "attention";

async function crawl(
  pages: string[],
  viewport: { width: number; height: number },
  theme: "dark" | "light",
  shoot: readonly string[],
): Promise<void> {
  const mode = `${viewport.width}x${viewport.height} ${theme}`;
  const { page, errors } = await open(viewport, theme);
  for (const path of pages) {
    errors.length = 0;
    await page.goto(`${base}#${path}`, { waitUntil: "load" });
    // A hash change alone doesn't reload; force a fresh document per deep link.
    await page.reload({ waitUntil: "load" });
    const issues = await settle(page);
    issues.push(...errors.map((error) => `console: ${error}`));
    for (const issue of issues) problems.push(`${mode} ${path}: ${issue}`);
    if (shoot.includes(path)) await screenshot(page, `${viewport.width}-${theme}-${slug(path)}`);
  }
  await page.context().close();
}

/** Expects `text` to appear (in a toast, a dialog…) within a few seconds. */
async function expectText(
  scope: Page | Locator,
  text: string | RegExp,
  what: string,
): Promise<void> {
  try {
    await scope.getByText(text).first().waitFor({ timeout: 8_000 });
  } catch {
    problems.push(`${what}: never showed ${text}`);
  }
}

async function interactions(): Promise<void> {
  const { page, errors } = await open({ width: 1440, height: 900 }, "dark");
  const skills = recorded<CatalogEntry[]>("/api/skills");
  const skill = skills[0]?.name ?? "";

  // ⌘K: content search runs in the browser with core's ranking.
  await page.goto(`${base}#/`, { waitUntil: "load" });
  await settle(page);
  await page.keyboard.press("Control+k");
  const input = page.getByPlaceholder("Search projects, skills, pages…");
  await input.waitFor({ timeout: 8_000 }).catch(() => problems.push("⌘K: menu didn't open"));
  await input.fill(skill.slice(0, 5));
  await expectText(page.getByRole("dialog"), skill, "⌘K search");
  await page.waitForTimeout(600);
  await screenshot(page, "interaction-command-menu");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  if (!page.url().includes("#/library/")) problems.push(`⌘K: Enter went to ${page.url()}`);

  // Library filter (debounced content search).
  await page.goto(`${base}#/library`, { waitUntil: "load" });
  await settle(page);
  await page.getByPlaceholder("Search skills and their content").fill(skill);
  await expectText(page.locator("main"), skill, "library filter");

  // A mutation from a loan's menu shows the read-only message.
  await page.goto(`${base}#/`, { waitUntil: "load" });
  await settle(page);
  await page.locator('button[aria-label^="Actions for"]').first().click();
  await page
    .getByRole("menuitem", { name: /Keep|Stop keeping/ })
    .first()
    .click();
  await expectText(page, "This is a read-only demo", "loan action");
  await page.waitForTimeout(600);
  await screenshot(page, "interaction-read-only-toast");

  // Reviewing a loan's changes shows the recorded diff.
  const review = page.getByRole("button", { name: "Review", exact: true });
  if ((await review.count()) > 0) {
    await review.first().click();
    await expectText(page.getByRole("dialog"), "SKILL.md", "review dialog");
    await page.waitForTimeout(600);
    await screenshot(page, "interaction-review");
    await page.keyboard.press("Escape");
  }

  // Saving SKILL.md from the editor: linting works as you type, saving is refused.
  await page.goto(`${base}#/library/${skill}`, { waitUntil: "load" });
  await settle(page);
  await page.locator(".cm-content").first().click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\nA line typed in the demo.");
  await page.getByRole("button", { name: /^Save/ }).first().click();
  await expectText(page, "This is a read-only demo", "saving a skill");

  // Deep link + reload keeps the page.
  await page.goto(`${base}#/library/${skill}`, { waitUntil: "load" });
  await page.reload({ waitUntil: "load" });
  await settle(page);
  const heading = await page.locator("main h1").first().textContent();
  if (!heading?.includes(skill)) problems.push(`reload: expected ${skill}, got ${heading}`);

  const misses = await page.evaluate(() => window.__shelfDemo?.misses ?? []);
  for (const miss of misses) problems.push(`interactions: snapshot has no ${miss}`);
  for (const error of errors) problems.push(`interactions: console: ${error}`);
  await page.context().close();
}

try {
  const pages = allPages();
  console.log(`checking ${pages.length} pages at ${base}`);
  const sample = samplePages(pages);
  await crawl(pages, { width: 1440, height: 900 }, "dark", sample);
  await crawl(sample, { width: 1440, height: 900 }, "light", sample);
  await crawl(sample, { width: 390, height: 844 }, "dark", sample);
  await crawl(sample, { width: 390, height: 844 }, "light", sample);
  await interactions();
} finally {
  await browser.close();
  await server.stop(true);
}

if (problems.length > 0) {
  console.error(`demo check failed:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("demo check passed");
