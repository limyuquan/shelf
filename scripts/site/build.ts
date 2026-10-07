/**
 * Builds the website into dist/site/ (`bun run site`):
 *
 *   /                      site/ (the landing page, tokens.css, fonts/), minus site/docs-theme/
 *   /brand/, /media/       assets/brand/, assets/media/
 *   /docs/                 the docs home, and /docs/<path>/ per page (docs/*.md)
 *   /docs/<path>.md        each page's Markdown, generated blocks filled, links absolute
 *   /docs/search.json      the search index (one entry per page section)
 *   /docs/assets/          docs.css and docs.js (site/docs-theme/)
 *   /llms.txt, /llms-full.txt, /sitemap.xml, /robots.txt, /404.html
 *   /schema/               schema/config.schema.json
 *   /demo/                 the live dashboard demo, when scripts/site/demo/build.ts exists
 *
 * Usage: bun scripts/site/build.ts [--docs <dir>] [--out <dir>]
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  type Assets,
  type HomeView,
  type Link,
  render404,
  renderDocPage,
  renderHome,
  TAGLINE,
} from "../../site/docs-theme/template.ts";
import {
  absoluteUrl,
  type DocPage,
  type Docs,
  loadDocs,
  markdownHref,
  pageDir,
  pageMarkdown,
  REPO_URL,
  ROOT,
  resolveLink,
  rewriteMarkdownLinks,
  SITE_URL,
  splitPage,
} from "./docs.ts";
import { highlightBlock, prepare } from "./highlight.ts";
import { renderMarkdown } from "./markdown.ts";

export interface BuildOptions {
  readonly docsDir: string;
  readonly outDir: string;
  /** Print warnings (missing nav.json, pages without a description, …). */
  readonly log?: (message: string) => void;
}

export interface BuildResult {
  readonly pages: number;
  readonly warnings: readonly string[];
}

export async function buildSite(options: BuildOptions): Promise<BuildResult> {
  const { docsDir, outDir } = options;
  const log = options.log ?? (() => {});
  const docs = loadDocs(docsDir);
  const warnings = [...docs.warnings];

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  // The landing page and the shared base (tokens.css, fonts/) are static files.
  cpSync(join(ROOT, "site"), outDir, {
    recursive: true,
    filter: (source) => !source.startsWith(join(ROOT, "site", "docs-theme")),
  });
  for (const [from, to] of [
    ["assets/brand", "brand"],
    ["assets/media", "media"],
  ] as const) {
    if (existsSync(join(ROOT, from)))
      cpSync(join(ROOT, from), join(outDir, to), { recursive: true });
  }
  if (existsSync(join(ROOT, "schema"))) {
    cpSync(join(ROOT, "schema"), join(outDir, "schema"), { recursive: true });
  }

  const assets = await buildTheme(outDir);
  await prepare();

  const write = (siteRel: string, content: string) => {
    const file = join(outDir, siteRel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  };

  // Pages: nav pages in order, then unlisted pages (reachable by links).
  const listed = docs.ordered;
  const unlisted = [...docs.pages.values()].filter(
    (page) => page.path !== "index" && page.group === null,
  );
  const search: SearchEntry[] = [];
  const copied = new Set<string>();
  const link = (page: DocPage | undefined): Link | null =>
    page ? { title: page.title, path: page.path, group: page.group } : null;

  for (const page of [...listed, ...unlisted]) {
    const index = listed.indexOf(page);
    const body = renderMarkdown(docs, page.path, page.body);
    const lede = renderMarkdown(docs, page.path, page.description);
    for (const asset of [...body.assets, ...lede.assets]) copied.add(asset);
    write(
      `${pageDir(page.path)}index.html`,
      renderDocPage(docs, assets, {
        page,
        ledeHtml: lede.html.trim().replace(/^<p>|<\/p>$/g, ""),
        bodyHtml: body.html,
        headings: body.headings,
        prev: index > 0 ? link(listed[index - 1]) : null,
        next: index >= 0 ? link(listed[index + 1]) : null,
      }),
    );
    write(pageMarkdown(page.path), publishedMarkdown(docs, page));
    for (const section of body.sections) {
      search.push({
        t: page.title,
        g: page.group ?? "",
        u: `${pageDir(page.path).slice("docs/".length)}${section.id ? `#${section.id}` : ""}`,
        h: section.heading,
        x: section.id
          ? section.text.slice(0, 600)
          : `${page.summary} ${section.text}`.slice(0, 600),
        k: section.keywords.join(" "),
      });
    }
    if (!body.sections.some((section) => section.id === "")) {
      search.push({
        t: page.title,
        g: page.group ?? "",
        u: pageDir(page.path).slice("docs/".length),
        h: "",
        x: page.summary,
        k: "",
      });
    }
  }

  // The docs home.
  write("docs/index.html", renderHome(docs, assets, homeView(docs, copied)));
  if (docs.home) write(pageMarkdown("index"), publishedMarkdown(docs, docs.home));

  for (const asset of copied) {
    const target = join(outDir, "docs", asset);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(docsDir, asset), target);
  }

  write("docs/search.json", JSON.stringify(search));
  write("llms.txt", llmsTxt(docs));
  write("llms-full.txt", llmsFull(docs));
  write("sitemap.xml", sitemap(docs));
  write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  write("404.html", render404(docs, assets));

  // ── Live demo hook ────────────────────────────────────────────────────────
  // The read-only dashboard demo (scripts/site/demo/build.ts, exporting
  // `buildDemo(outDir: string): Promise<void>`) builds into /demo/. It is
  // written separately; the build runs it as soon as the file exists.
  const demoEntry = join(ROOT, "scripts/site/demo/build.ts");
  if (existsSync(demoEntry)) {
    const { buildDemo } = (await import(demoEntry)) as {
      buildDemo: (outDir: string) => Promise<void>;
    };
    await buildDemo(join(outDir, "demo"));
  }
  // ──────────────────────────────────────────────────────────────────────────

  for (const warning of warnings) log(`warning: ${warning}`);
  return { pages: listed.length + unlisted.length + 1, warnings };
}

/** Bundles docs.ts and copies docs.css, with content hashes for cache busting. */
async function buildTheme(outDir: string): Promise<Assets> {
  const theme = join(ROOT, "site/docs-theme");
  const result = await Bun.build({
    entrypoints: [join(theme, "docs.ts")],
    target: "browser",
    minify: true,
  });
  if (!result.success) throw new AggregateError(result.logs, "Bundling docs.ts failed");
  const js = await (result.outputs[0] as Blob).text();
  const css = readFileSync(join(theme, "docs.css"), "utf8");
  const hash = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 10);
  mkdirSync(join(outDir, "docs/assets"), { recursive: true });
  writeFileSync(join(outDir, "docs/assets/docs.js"), js);
  writeFileSync(join(outDir, "docs/assets/docs.css"), css);
  return {
    js: `docs/assets/docs.js?v=${hash(js)}`,
    css: `docs/assets/docs.css?v=${hash(css)}`,
  };
}

const DEFAULT_QUICKSTART = [
  "$ npm install -g @limyuquan/shelf",
  "$ shelf setup",
  "$ cd ~/code/storefront && shelf init",
  "$ shelf borrow pdf-tools",
].join("\n");

/** docs/index.md: title, description, then an intro whose first code block becomes the terminal. */
function homeView(docs: Docs, copied: Set<string>): HomeView {
  const home = docs.home;
  const first = (path: string) => docs.pages.get(path) ?? null;
  const start = docs.ordered[0] ?? null;
  const cli = first("cli/index") ?? first("cli");
  const toLink = (page: DocPage | null): Link | null =>
    page ? { title: page.title, path: page.path, group: page.group } : null;

  let intro = home?.body ?? "";
  let terminal = DEFAULT_QUICKSTART;
  let lang = "console";
  const fence = intro.match(/^(```|~~~)([^\n]*)\n([\s\S]*?)\n\1[^\n]*$/m);
  if (fence) {
    terminal = fence[3] ?? "";
    lang = (fence[2] ?? "").trim() || "console";
    intro = intro.replace(fence[0], "").trim();
  }
  const introRendered = intro ? renderMarkdown(docs, "index", intro) : null;
  for (const asset of introRendered?.assets ?? []) copied.add(asset);
  const lede = home ? renderMarkdown(docs, "index", home.description).html : "";
  return {
    title: home?.title ?? "shelf docs",
    ledeHtml: lede.trim().replace(/^<p>|<\/p>$/g, "") || TAGLINE,
    summary: home?.summary ?? TAGLINE,
    introHtml: introRendered?.html ?? "",
    terminalHtml: highlightBlock(terminal, lang).html,
    start: toLink(start),
    cli: toLink(cli),
  };
}

interface SearchEntry {
  /** Page title. */
  readonly t: string;
  /** Nav group. */
  readonly g: string;
  /** URL relative to /docs/, with the section's anchor. */
  readonly u: string;
  /** Section heading ("" for the top of the page). */
  readonly h: string;
  /** Section text. */
  readonly x: string;
  /** Inline code in the section: command names, flags. */
  readonly k: string;
}

/** A page's Markdown as published: generated blocks filled, links absolute. */
function publishedMarkdown(docs: Docs, page: DocPage, options: { stripImages?: boolean } = {}) {
  return `${rewriteMarkdownLinks(
    page.markdown.trim(),
    (href) => markdownHref(resolveLink(docs, page.path, href), page.path),
    options,
  )}\n`;
}

function llmsTxt(docs: Docs): string {
  const preamble = docs.preamble ?? `# shelf\n\n> ${TAGLINE}`;
  const groups = docs.nav
    .map(({ group, pages }) => {
      const items = pages
        .map((path) => docs.pages.get(path))
        .filter((page): page is DocPage => page !== undefined)
        .map(
          (page) =>
            `- [${page.title}](${absoluteUrl(pageMarkdown(page.path))})${page.summary ? `: ${page.summary}` : ""}`,
        );
      return items.length > 0 ? `## ${group}\n\n${items.join("\n")}` : "";
    })
    .filter(Boolean);
  const architecture = docs.pages.has("ARCHITECTURE")
    ? absoluteUrl(pageMarkdown("ARCHITECTURE"))
    : `${REPO_URL}/blob/main/docs/ARCHITECTURE.md`;
  const optional = [
    "## Optional",
    "",
    `- [Full docs in one file](${SITE_URL}/llms-full.txt): every page above, in order`,
    `- [Source code](${REPO_URL}): the repository (MIT)`,
    `- [Architecture](${architecture}): how the code is organised, for contributors`,
    `- [Config JSON Schema](${SITE_URL}/schema/config.schema.json): ~/.shelf/config.json`,
    `- [Website](${SITE_URL}/): the landing page`,
  ].join("\n");
  return `${[preamble, ...groups, optional].join("\n\n")}\n`;
}

function llmsFull(docs: Docs): string {
  const preamble = docs.preamble ?? `# shelf\n\n> ${TAGLINE}`;
  const pages = docs.ordered.map((page) => {
    // Generated-block markers and the gaps left by images are noise in one long file.
    const markdown = publishedMarkdown(docs, page, { stripImages: true })
      .replace(/^<!-- \/?generated[^>]*-->\n\n?/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const { title } = splitPage(markdown);
    // "Source:" under each page's title, so an agent can cite and fetch it.
    return markdown.replace(
      /^#\s+.+$/m,
      `# ${title}\n\nSource: ${absoluteUrl(pageMarkdown(page.path))}`,
    );
  });
  return `${[preamble, ...pages].join("\n\n---\n\n")}\n`;
}

function sitemap(docs: Docs): string {
  const urls = [
    `${SITE_URL}/`,
    absoluteUrl("docs/"),
    ...[...docs.pages.values()]
      .filter((page) => page.path !== "index")
      .map((page) => absoluteUrl(pageDir(page.path))),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n")}
</urlset>
`;
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      docs: { type: "string", default: join(ROOT, "docs") },
      out: { type: "string", default: join(ROOT, "dist/site") },
    },
  });
  const started = performance.now();
  const outDir = resolve(values.out);
  const result = await buildSite({
    docsDir: resolve(values.docs),
    outDir,
    log: (message) => console.warn(message),
  });
  const ms = Math.round(performance.now() - started);
  console.log(`built ${relative(process.cwd(), outDir)}: ${result.pages} pages in ${ms} ms`);
}
