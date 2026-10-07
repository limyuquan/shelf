/**
 * Renders the social card (site/og.png, 1280×640) from scripts/site/og.html.
 * The card uses the site's tokens, fonts and dithered scene, and the dashboard
 * still from assets/media/dashboard.png.
 *
 * Usage: bun scripts/site/og.ts [--shot <image>] [--out <file>]
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

const root = resolve(import.meta.dir, "../..");
const { values } = parseArgs({
  options: { shot: { type: "string" }, out: { type: "string" } },
});

const shot = resolve(values.shot ?? join(root, "assets/media/dashboard.png"));
if (!existsSync(shot)) {
  console.error(`Missing ${shot}. Capture the media first, or pass --shot <image>.`);
  process.exit(1);
}
const out = resolve(values.out ?? join(root, "site/og.png"));
const page = pathToFileURL(join(root, "scripts/site/og.html"));
page.searchParams.set("shot", pathToFileURL(shot).href);

// The GPU flags keep Chromium stable on machines where the GPU is busy.
const browser = await chromium.launch({
  args: ["--disable-gpu", "--disable-software-rasterizer", "--disable-dev-shm-usage"],
});
try {
  const tab = await browser.newPage({ viewport: { width: 1280, height: 640 } });
  await tab.goto(page.href, { waitUntil: "load" });
  await tab.waitForSelector("canvas[data-ready]");
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(800); // the scene fades in
  await tab.screenshot({ path: out });
  console.log(`Wrote ${out}`);
} finally {
  await browser.close();
}
