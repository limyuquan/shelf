/**
 * Regenerates the product screenshots and videos in assets/media/ from a fresh
 * demo shelf (scripts/demo/seed.ts), so they can be redone after UI changes.
 *
 * Needs Playwright's Chromium (`bunx playwright install chromium`) and ffmpeg
 * built with libx264 and libwebp.
 *
 * Usage: bun run media [--only dashboard,hero,...] [--port 4201] [--keep]
 *   --only   capture some of the shots (names below)
 *   --port   dashboard port (default 4201)
 *   --keep   keep the raw frames and the demo shelf in $TMPDIR/shelf-media-capture
 */
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { closeContext, createContext } from "@shelf/core";
import { loadToken, startServer } from "@shelf/server";
import { $ } from "bun";
import {
  type Browser,
  type BrowserContext,
  type CDPSession,
  chromium,
  type Locator,
  type Page,
} from "playwright";
import pkg from "../../packages/cli/package.json" with { type: "json" };
import bundledSkill from "../../packages/skill/SKILL.md" with { type: "text" };
import page from "../../packages/web/index.html";
import { seedDemo } from "../demo/seed.ts";
import { installCursor } from "./cursor.ts";

const { values } = parseArgs({
  options: {
    only: { type: "string" },
    port: { type: "string", default: "4201" },
    keep: { type: "boolean", default: false },
  },
});

const OUT = join(import.meta.dir, "../../assets/media");
const WORK = join(tmpdir(), "shelf-media-capture");
// The demo's HOME. The dashboard shows paths under it as ~/…, so its name never shows.
const HOME = join(WORK, "home");
const PRISTINE = join(WORK, "home.pristine");
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const FPS = 30;

type Theme = "dark" | "light";

// ── The demo shelf and the dashboard ─────────────────────────────────────────

interface Dashboard {
  readonly origin: string;
  readonly token: string;
  stop(): Promise<void>;
}
let dashboard = null as Dashboard | null;

async function startDashboard() {
  const env = { ...process.env, HOME, SHELF_HOME: join(HOME, ".shelf") };
  const ctx = await createContext({ actor: "user:dashboard", env });
  const token = await loadToken(ctx.paths.home);
  const server = startServer(ctx, {
    page,
    port: Number(values.port),
    token,
    system: { version: pkg.version, bundledSkill, hookCommand: "shelf" },
  });
  dashboard = {
    origin: `http://127.0.0.1:${server.port}`,
    token,
    async stop() {
      await server.stop();
      closeContext(ctx);
    },
  };
}

/** Puts the demo back as seeded, so every recording starts from the same state. */
async function resetDemo() {
  await dashboard?.stop();
  await rm(HOME, { recursive: true, force: true });
  await $`cp -a ${PRISTINE} ${HOME}`.quiet();
  await startDashboard();
}

// ── Browser helpers ──────────────────────────────────────────────────────────

let browser = null as unknown as Browser;

async function launch() {
  browser = await chromium.launch({
    // The GPU may be busy with other work; software rendering is steadier.
    args: ["--disable-gpu", "--disable-software-rasterizer", "--disable-dev-shm-usage"],
  });
}

interface PageOptions {
  theme?: Theme;
  phone?: boolean;
  scale?: number;
  cursor?: boolean;
}

async function openPage(path: string, ready: string, options: PageOptions = {}) {
  if (!dashboard) throw new Error("The dashboard is not running");
  const context: BrowserContext = await browser.newContext({
    viewport: options.phone ? PHONE : DESKTOP,
    deviceScaleFactor: options.scale ?? 1,
    colorScheme: options.theme ?? "dark",
    isMobile: options.phone ?? false,
    hasTouch: options.phone ?? false,
    reducedMotion: "no-preference",
  });
  await context.addInitScript(
    (token) => localStorage.setItem("shelf.token", token),
    dashboard.token,
  );
  if (options.cursor) {
    await context.addInitScript(installCursor);
    await context.clock.install();
  }
  const tab = await context.newPage();
  tab.setDefaultTimeout(90_000);
  await tab.goto(dashboard.origin + path, { waitUntil: "domcontentloaded" });
  await settle(tab, ready);
  return tab;
}

/** Waits for `selector`, web fonts and the first round of data to render. */
async function settle(tab: Page, selector: string) {
  await tab.locator(`${selector} >> visible=true`).first().waitFor();
  await tab.evaluate(() => document.fonts.ready.then(() => undefined));
  await tab.waitForTimeout(900);
}

async function closePage(tab: Page) {
  await tab.context().close();
}

/** Screenshots time out now and then on a loaded machine; try again. */
async function screenshot(tab: Page): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await tab.screenshot({ timeout: 60_000, animations: "disabled", caret: "hide" });
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
}

/** Scrolls the page's main scroll area (the tallest scrollable element). */
async function scrollMain(tab: Page, top: number, ms = 0) {
  await tab.evaluate(
    ({ top, ms }) =>
      new Promise<void>((resolve) => {
        const scrollers = [...document.querySelectorAll<HTMLElement>("*")].filter(
          (el) =>
            el.scrollHeight > el.clientHeight + 4 &&
            /auto|scroll/.test(getComputedStyle(el).overflowY),
        );
        scrollers.sort((a, b) => b.clientHeight - a.clientHeight);
        const el = scrollers[0] ?? document.scrollingElement;
        if (!el) return resolve();
        const from = el.scrollTop;
        if (ms === 0) {
          el.scrollTop = top;
          return resolve();
        }
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / ms);
          const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
          el.scrollTop = from + (top - from) * e;
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      }),
    { top, ms },
  );
}

// ── Recording ────────────────────────────────────────────────────────────────

interface CursorApi {
  move(x: number, y: number, ms?: number): Promise<void>;
  press(): void;
  release(): void;
  keys(labels: string[], ms?: number): void;
}
declare global {
  interface Window {
    __cursor: CursorApi;
    __done?: boolean;
  }
}

/**
 * Films a page frame by frame on a virtual clock, so a slow or busy machine
 * still gives smooth 30 fps: Playwright's clock drives the page's timers and
 * requestAnimationFrame (and the fake cursor with them), and CSS animations and
 * transitions are paused and moved to the same time before each frame.
 */
class Film {
  readonly frames: Buffer[] = [];
  private elapsed = 0;
  private cdp: CDPSession | null = null;

  constructor(readonly tab: Page) {}

  async start() {
    this.cdp = await this.tab.context().newCDPSession(this.tab);
    const now = await this.tab.evaluate(() => Date.now());
    await this.tab.clock.pauseAt(now + 100);
    await this.frame();
  }

  /** Advances the clock by one frame and captures it. */
  async frame() {
    const target = Math.round(((this.frames.length + 1) * 1000) / FPS);
    await this.tab.clock.runFor(target - this.elapsed);
    this.elapsed = target;
    await this.tab.evaluate(() => {
      const w = window as unknown as { __seen?: WeakMap<Animation, number> };
      w.__seen ??= new WeakMap();
      const seen = w.__seen;
      const now = performance.now();
      for (const animation of document.getAnimations()) {
        if (!seen.has(animation)) {
          seen.set(animation, now);
          animation.pause();
        }
        animation.currentTime = now - (seen.get(animation) ?? now);
      }
    });
    this.frames.push(await this.capture());
  }

  private async capture(): Promise<Buffer> {
    if (!this.cdp) throw new Error("The film has not started");
    for (let attempt = 1; ; attempt++) {
      try {
        const { data } = await this.cdp.send("Page.captureScreenshot", {
          format: "jpeg",
          quality: 92,
        });
        return Buffer.from(data, "base64");
      } catch (error) {
        if (attempt === 3) throw error;
      }
    }
  }

  async hold(ms: number) {
    const count = Math.max(1, Math.round((ms * FPS) / 1000));
    for (let i = 0; i < count; i++) await this.frame();
  }

  /** Films until `done()` is true (checked before each frame), for at most `ms`. */
  async until(done: () => Promise<boolean>, what: string, ms = 15_000) {
    for (let t = 0; t < ms; t += 1000 / FPS) {
      if (await done()) return;
      await this.frame();
    }
    const last = join(WORK, "timed-out.jpg");
    await writeFile(last, this.frames.at(-1) ?? Buffer.alloc(0));
    throw new Error(`Timed out while filming: ${what} (last frame: ${last})`);
  }

  /** Films until `target` is visible. */
  async waitFor(target: Locator) {
    await this.until(() => target.first().isVisible(), `waiting for ${target}`);
  }

  private async point(target: Locator, at?: { x?: number; y?: number }) {
    await this.waitFor(target);
    const box = await target.first().boundingBox();
    if (!box) throw new Error(`No box for ${target}`);
    return { x: box.x + (at?.x ?? box.width / 2), y: box.y + (at?.y ?? box.height / 2) };
  }

  /** Glides the fake cursor to `target`, then hovers it with the real mouse. */
  async hover(target: Locator, at?: { x?: number; y?: number }) {
    const { x, y } = await this.point(target, at);
    await this.tab.evaluate(
      ({ x, y }) => {
        window.__done = false;
        void window.__cursor.move(x, y).then(() => {
          window.__done = true;
        });
      },
      { x, y },
    );
    await this.until(() => this.tab.evaluate(() => window.__done === true), "cursor", 3000);
    await this.tab.mouse.move(x, y);
  }

  async click(target: Locator, at?: { x?: number; y?: number }) {
    await this.hover(target, at);
    await this.hold(200);
    await this.tab.evaluate(() => window.__cursor.press());
    await this.tab.mouse.down();
    await this.hold(90);
    await this.tab.mouse.up();
    await this.tab.evaluate(() => window.__cursor.release());
    await this.hold(250);
  }

  /** Types like a person: a little uneven, never instant. */
  async type(text: string) {
    let n = 7;
    for (const char of text) {
      await this.tab.keyboard.type(char);
      n = (n * 31 + char.charCodeAt(0)) % 97;
      await this.hold(70 + (n % 60) + (char === " " ? 50 : 0));
    }
  }

  /** Presses a shortcut and shows its keys on screen. */
  async shortcut(keys: string, labels: string[]) {
    await this.tab.evaluate((labels) => window.__cursor.keys(labels), labels);
    await this.hold(150);
    await this.tab.keyboard.press(keys);
  }

  /** Smoothly scrolls the main scroll area to `top`. */
  async scroll(top: number, ms = 1200) {
    await this.tab.evaluate(
      ({ top, ms }) => {
        window.__done = false;
        const scrollers = [...document.querySelectorAll<HTMLElement>("*")].filter(
          (el) =>
            el.scrollHeight > el.clientHeight + 4 &&
            /auto|scroll/.test(getComputedStyle(el).overflowY),
        );
        scrollers.sort((a, b) => b.clientHeight - a.clientHeight);
        const el = scrollers[0] ?? document.documentElement;
        const from = el.scrollTop;
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / ms);
          el.scrollTop = from + (top - from) * (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
          if (t < 1) requestAnimationFrame(step);
          else window.__done = true;
        };
        requestAnimationFrame(step);
      },
      { top, ms },
    );
    await this.until(() => this.tab.evaluate(() => window.__done === true), "scroll", ms + 2000);
  }
}

interface VideoOptions {
  /** Upper bound in bytes; CRF rises until the clip fits. */
  maxBytes: number;
  /** Seconds into the recording for the poster frame. */
  poster: number;
  /** Crossfade the end into the start so the clip loops (seconds; 0 for none). */
  loopFade?: number;
}

async function encodeVideo(name: string, film: Film, options: VideoOptions) {
  const { frames } = film;
  const dir = join(WORK, "frames", name);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  for (const [index, frame] of frames.entries()) {
    await writeFile(join(dir, `${String(index).padStart(5, "0")}.jpg`), frame);
  }
  const length = frames.length / FPS;
  const fade = options.loopFade ?? 0;
  const base = `scale=${DESKTOP.width}:${DESKTOP.height}:flags=lanczos,format=yuv420p,settb=AVTB`;
  // Starting `fade` seconds in and ending with a fade into those seconds makes
  // the last frame lead straight into the first.
  const filter =
    fade > 0
      ? `[0]${base},split[a][b];` +
        `[a]trim=start=${fade},setpts=PTS-STARTPTS[main];` +
        `[b]trim=duration=${fade},setpts=PTS-STARTPTS[head];` +
        `[main][head]xfade=transition=fade:duration=${fade}:offset=${(length - 2 * fade).toFixed(3)}[v]`
      : `[0]${base}[v]`;

  const output = join(OUT, `${name}.mp4`);
  for (let crf = 18; ; crf += 2) {
    await $`ffmpeg -y -loglevel error -framerate ${FPS} -i ${join(dir, "%05d.jpg")} -filter_complex ${filter} -map [v] -an -c:v libx264 -preset slow -tune animation -crf ${crf} -r ${FPS} -pix_fmt yuv420p -movflags +faststart ${output}`;
    const size = (await stat(output)).size;
    if (size <= options.maxBytes || crf >= 34) {
      console.log(`  ${name}.mp4  ${kb(size)}  crf ${crf}  ${(length - fade).toFixed(1)} s`);
      break;
    }
  }

  // The poster is the source frame at that moment, not a re-encoded one.
  const poster = frames[Math.min(frames.length - 1, Math.round(options.poster * FPS))];
  if (!poster) return;
  const raw = join(dir, "poster.jpg");
  await writeFile(raw, poster);
  await $`ffmpeg -y -loglevel error -i ${raw} -vf scale=${DESKTOP.width}:${DESKTOP.height}:flags=lanczos -q:v 3 ${join(OUT, `${name}.jpg`)}`;
  console.log(`  ${name}.jpg  ${kb((await stat(join(OUT, `${name}.jpg`))).size)}`);
}

// ── Stills ───────────────────────────────────────────────────────────────────

const MAX_PNG_BYTES = 600 * 1024;

/**
 * Writes `name.png` (for the README) and `name.webp` (for the site) from one
 * screenshot. Both are lossless; a PNG over the size budget is quantized to a
 * 256-colour palette, which flat UI survives without visible loss.
 */
async function saveStill(name: string, image: Buffer) {
  const raw = join(WORK, `${name}.raw.png`);
  await writeFile(raw, image);
  const png = join(OUT, `${name}.png`);
  await $`ffmpeg -y -loglevel error -i ${raw} -compression_level 9 ${png}`;
  if ((await stat(png)).size > MAX_PNG_BYTES) {
    const palette =
      "split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a";
    await $`ffmpeg -y -loglevel error -i ${raw} -vf ${palette} -compression_level 9 ${png}`;
  }
  const webp = join(OUT, `${name}.webp`);
  await $`ffmpeg -y -loglevel error -i ${raw} -c:v libwebp -lossless 1 -compression_level 6 ${webp}`;
  console.log(
    `  ${name}.png  ${kb((await stat(png)).size)}   ${name}.webp  ${kb((await stat(webp)).size)}`,
  );
}

const MB = 1024 * 1024;
const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

// ── The shots ────────────────────────────────────────────────────────────────

const row = (tab: Page, skill: string, project: string) =>
  tab
    .locator("div.group")
    .filter({ has: tab.getByRole("link", { name: skill, exact: true }) })
    .filter({ has: tab.getByRole("link", { name: project }) });

const sidebar = (tab: Page, name: string) =>
  tab
    .locator("aside")
    .getByRole("link", { name: new RegExp(`\\b${name}\\b`) })
    .first();

const projectId = async (tab: Page, name: string) => {
  const href = await tab
    .getByRole("link", { name: new RegExp(`^\\S?\\s*${name}`) })
    .first()
    .getAttribute("href");
  return href ?? "/projects";
};

const SHOTS: Record<string, () => Promise<void>> = {
  async dashboard() {
    for (const theme of ["dark", "light"] as const) {
      const tab = await openPage("/", "text=Updates available", { theme, scale: 2 });
      // Hover a loan, so its one-click action shows.
      const due = row(tab, "accessibility-audit", "storefront");
      const box = await due.boundingBox();
      if (box) await tab.mouse.move(box.x + 900, box.y + box.height / 2);
      await tab.waitForTimeout(400);
      await saveStill(theme === "dark" ? "dashboard" : "dashboard-light", await screenshot(tab));
      await closePage(tab);
    }
  },

  async project() {
    const tab = await openPage("/projects", "text=billing-api", { scale: 2 });
    await tab.goto(dashboard?.origin + (await projectId(tab, "billing-api")));
    await settle(tab, "text=Suggested for this project");
    await saveStill("project", await screenshot(tab));
    await closePage(tab);
  },

  async insights() {
    const tab = await openPage("/insights", "text=Context at session start", { scale: 2 });
    // Start at the context chart's heading, just below the page header.
    const heading = await tab.getByText("Context at session start").boundingBox();
    await scrollMain(tab, (heading?.y ?? 225) - 84);
    await tab.waitForTimeout(400);
    await saveStill("insights", await screenshot(tab));
    await closePage(tab);
  },

  async activity() {
    const tab = await openPage("/activity", "text=Today", { scale: 2 });
    await saveStill("activity", await screenshot(tab));
    await closePage(tab);
  },

  async mobile() {
    const attention = await openPage("/", "text=Updates available", { phone: true, scale: 3 });
    await saveStill("mobile-attention", await screenshot(attention));
    await closePage(attention);
    const tab = await openPage("/projects", "text=billing-api", { phone: true, scale: 3 });
    await tab.goto(dashboard?.origin + (await projectId(tab, "billing-api")));
    await settle(tab, "text=Suggested for this project");
    await saveStill("mobile-project", await screenshot(tab));
    await closePage(tab);
  },

  async attention() {
    const film = await startFilm("/", "text=Updates available");
    await film.hold(900);

    // Review a loan edited in a project, then promote the edits to the library.
    const edited = row(film.tab, "git-hygiene", "billing-api");
    await film.hover(edited, { x: 420 });
    await film.hold(350);
    await film.click(edited.getByRole("button", { name: "Review" }));
    await film.waitFor(film.tab.getByText("Squash fixup commits"));
    await film.hold(2400);
    await film.click(film.tab.getByRole("button", { name: "Promote to library" }));
    await film.hold(1300);

    // Renew a loan that is due soon.
    const due = row(film.tab, "accessibility-audit", "storefront");
    await film.hover(due, { x: 420 });
    await film.hold(350);
    await film.click(due.getByRole("button", { name: "Renew" }));
    await film.hold(1300);

    // Update every loan that is behind the library at once.
    const group = film.tab.getByRole("checkbox", { name: /Select every updates available/ });
    await film.click(group);
    await film.hold(700);
    await film.click(film.tab.getByRole("button", { name: "Update", exact: true }));
    await film.hold(2000);

    await encodeVideo("attention", film, { maxBytes: 2.5 * MB, poster: 4.6, loopFade: 0.6 });
    await closePage(film.tab);
  },

  async library() {
    const film = await startFilm("/library", "text=Sets");
    const { tab } = film;
    await film.hold(900);

    // Find a skill by name or content, and open it.
    await film.click(tab.getByPlaceholder("Search skills and their content"), { x: 120 });
    await film.type("release");
    await film.hold(900);
    await film.click(tab.getByRole("link", { name: /^release-notes/ }), { x: 70 });
    await film.waitFor(tab.getByText("description doesn't say when"));
    await film.hold(1400);

    // The lint strip asks for a "when": add one at the end of the description.
    const line = tab.locator(".cm-line", { hasText: "description:" }).first();
    const box = await line.boundingBox();
    const end = await line.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getBoundingClientRect().right;
    });
    await film.click(line, { x: end - (box?.x ?? 0) + 4 });
    await tab.keyboard.press("End");
    await film.type(" Use when preparing a release.");
    await film.hold(1400);

    // Save: a new revision appears in the history. Open it to see what changed.
    await film.click(tab.getByRole("button", { name: /^Save/ }));
    await film.hold(1500);
    await film.click(tab.locator('a[href*="/revisions/"]').first(), { x: 30 });
    await film.waitFor(tab.getByText("Compare with"));
    await film.hold(2800);

    await encodeVideo("library", film, { maxBytes: 2.5 * MB, poster: 8.5, loopFade: 0.6 });
    await closePage(tab);
  },

  async search() {
    const film = await startFilm("/", "text=Updates available");
    const { tab } = film;
    await film.hold(900);

    // Search inside skills, and jump to the matching file.
    await film.shortcut("ControlOrMeta+k", ["⌘", "K"]);
    await film.hold(600);
    await film.type("fixtures");
    await film.hold(1500);
    await film.click(tab.getByRole("option").filter({ hasText: "pytest-patterns" }).last(), {
      x: 60,
    });
    await film.hold(2200);

    // Then jump to a project. The menu keeps the last query: replace it.
    await film.shortcut("ControlOrMeta+k", ["⌘", "K"]);
    await film.hold(500);
    const input = tab.getByPlaceholder("Search projects, skills, pages…");
    await input.focus();
    await input.selectText();
    await film.hold(250);
    await film.type("billing");
    await film.hold(900);
    const project = tab
      .getByRole("option")
      .filter({ hasText: /billing-api$/ })
      .filter({ hasNotText: "Borrow" });
    await film.click(project, { x: 70 });
    await film.hold(2400);

    await encodeVideo("search", film, { maxBytes: 2.5 * MB, poster: 3.4, loopFade: 0.6 });
    await closePage(tab);
  },

  async hero() {
    const film = await startFilm("/", "text=Updates available");
    const { tab } = film;
    await film.hold(1000);

    // Attention: review a project's edits and promote them.
    const edited = row(tab, "git-hygiene", "billing-api");
    await film.hover(edited, { x: 420 });
    await film.hold(300);
    await film.click(edited.getByRole("button", { name: "Review" }));
    await film.waitFor(tab.getByText("Squash fixup commits"));
    await film.hold(1800);
    await film.click(tab.getByRole("button", { name: "Promote to library" }));
    await film.hold(900);

    // A project: its loans, and a suggestion borrowed in one click.
    await film.click(sidebar(tab, "billing-api"));
    await film.waitFor(tab.getByText("Suggested for this project"));
    await film.hold(900);
    await film.click(tab.getByRole("button", { name: "Borrow pdf-tools" }));
    await film.hold(1300);

    // The library and a skill with its history.
    await film.click(sidebar(tab, "Library"));
    await film.waitFor(tab.getByText("Sets"));
    await film.hold(600);
    await film.click(tab.getByRole("link", { name: /^react-best-practices/ }), { x: 90 });
    await film.waitFor(tab.getByText("History"));
    await film.hold(900);
    await film.scroll(380, 1200);
    await film.hold(600);

    // Jump anywhere with the command menu.
    await film.shortcut("ControlOrMeta+k", ["⌘", "K"]);
    await film.hold(500);
    await film.type("insights");
    await film.hold(500);
    await film.shortcut("Enter", ["↵"]);
    await film.waitFor(tab.getByText("Context at session start"));
    await film.hold(700);
    const heading = await tab.getByText("Context at session start").boundingBox();
    await film.scroll((heading?.y ?? 225) - 84, 1400);
    await film.hold(1600);

    await encodeVideo("hero", film, { maxBytes: 4 * MB, poster: 9, loopFade: 0.7 });
    await closePage(tab);
  },
};

/**
 * Resets the demo, opens `path` with the fake cursor, and starts filming. Frames
 * are taken at twice the size and scaled down, which keeps text crisp.
 */
async function startFilm(path: string, ready: string) {
  await resetDemo();
  const tab = await openPage(path, ready, { cursor: true, scale: 2 });
  const film = new Film(tab);
  await film.start();
  return film;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const only = values.only?.split(",").filter(Boolean);
const names = only ?? Object.keys(SHOTS);
for (const name of names) {
  if (!SHOTS[name])
    throw new Error(`Unknown shot "${name}". Shots: ${Object.keys(SHOTS).join(", ")}`);
}

await mkdir(OUT, { recursive: true });
await mkdir(WORK, { recursive: true });
console.log("Seeding the demo shelf…");
await seedDemo(HOME, { hooks: true });
await rm(PRISTINE, { recursive: true, force: true });
await $`cp -a ${HOME} ${PRISTINE}`.quiet();
await startDashboard();
await launch();
try {
  for (const name of names) {
    console.log(name);
    await SHOTS[name]?.();
  }
} finally {
  await browser?.close();
  await dashboard?.stop();
  if (!values.keep) {
    for (const entry of await readdir(WORK))
      await rm(join(WORK, entry), { recursive: true, force: true });
  }
}
