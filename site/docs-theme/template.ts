/**
 * HTML for docs pages, the docs home and the 404 page. Used by the site build
 * (scripts/site/build.ts); docs.css and docs.ts (bundled to docs.js) are the
 * client side. Every internal URL is relative to the page, so the site works
 * under any base path; canonical and Open Graph URLs are absolute.
 */
import {
  absoluteUrl,
  type DocPage,
  type Docs,
  pageDir,
  pageMarkdown,
  REPO_URL,
  relativeUrl,
  SITE_URL,
} from "../../scripts/site/docs.ts";
import type { Heading } from "../../scripts/site/markdown.ts";

export const TAGLINE = "A personal skill library for coding agents.";

export interface Assets {
  /** Site-root-relative URLs with a cache-busting query. */
  readonly css: string;
  readonly js: string;
}

export interface Link {
  readonly title: string;
  readonly path: string;
  readonly group: string | null;
}

export interface PageView {
  readonly page: DocPage;
  readonly ledeHtml: string;
  readonly bodyHtml: string;
  readonly headings: readonly Heading[];
  readonly prev: Link | null;
  readonly next: Link | null;
}

export interface HomeView {
  readonly title: string;
  readonly ledeHtml: string;
  readonly summary: string;
  readonly introHtml: string;
  readonly terminalHtml: string;
  readonly start: Link | null;
  readonly cli: Link | null;
}

const esc = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// ---------------------------------------------------------------------------
// Icons (16px, stroked, currentColor)

const svg = (body: string, size = 16) =>
  `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const icons = {
  search: svg('<circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/>'),
  sun: svg(
    '<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"/>',
  ),
  moon: svg('<path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z"/>'),
  menu: svg('<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/>'),
  close: svg('<path d="m4 4 8 8M12 4l-8 8"/>'),
  copy: svg(
    '<path d="M5 2.5h6.5a2 2 0 0 1 2 2V11"/><rect x="2.5" y="5" width="8" height="9" rx="1.2"/>',
  ),
  check: svg('<path d="m3 8.5 3 3 7-7"/>'),
  chevronDown: svg('<path d="m4 6 4 4 4-4"/>'),
  chevronRight: svg('<path d="m6 4 4 4-4 4"/>'),
  arrowLeft: svg('<path d="M13 8H3M7 4 3 8l4 4"/>'),
  arrowRight: svg('<path d="M3 8h10M9 4l4 4-4 4"/>'),
  external: svg('<path d="M6 3.5H3.5v9h9V10M9 3h4v4M13 3 7.5 8.5"/>'),
  markdown: svg(
    '<rect x="1.5" y="3.5" width="13" height="9" rx="1.5"/><path d="M4 10.5v-5l2 2.5 2-2.5v5M10.5 8.5l1.5 2 1.5-2M12 10.5V5.5"/>',
  ),
  file: svg(
    '<path d="M9.5 1.5h-5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-9l-3-3Z"/><path d="M9.5 1.5v3h3M5.5 8.5h5M5.5 11h3"/>',
  ),
  chat: svg(
    '<path d="M2.5 3.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H6l-3.5 3v-3H3.5a1 1 0 0 1-1-1Z"/>',
  ),
  edit: svg('<path d="m10 3 3 3-7.5 7.5H2.5v-3Z"/><path d="m8.5 4.5 3 3"/>'),
  issue: svg('<circle cx="8" cy="8" r="6"/><path d="M8 5v3.5M8 11h.01"/>'),
  github:
    '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>',
};

// ---------------------------------------------------------------------------
// Shell

interface ShellOptions {
  readonly docs: Docs;
  readonly assets: Assets;
  /** Site-root-relative directory of the page, e.g. `docs/cli/borrow/`. */
  readonly dir: string;
  /** Docs path of the page, for the active nav item (null: none). */
  readonly active: string | null;
  readonly title: string;
  readonly description: string;
  /** Absolute canonical URL, or null (404). */
  readonly canonical: string | null;
  /** Site-root-relative `.md` alternate, if the page has one. */
  readonly markdown: string | null;
  readonly jsonLd: readonly object[];
  readonly bodyClass: string;
  readonly main: string;
  readonly rail: string;
  /** For the 404 page, which is served at any depth: set <base> from the URL. */
  readonly dynamicBase?: boolean;
}

/** Applies the saved theme (or the system's) before first paint: no flash of the wrong theme. */
const THEME_INIT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("shelf-theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";d.dataset.theme=t}catch(e){}})()`;

/** GitHub Pages serves 404.html for any missing path: resolve relative URLs from the site root. */
const BASE_INIT = `(function(){var m=location.pathname.match(/^\\/shelf\\//);document.write('<base href="'+(m?"/shelf/":"/")+'">')})()`;

function shell(o: ShellOptions): string {
  const root = o.dynamicBase ? "" : relativeUrl(o.dir, "").replace(/^\.\/$/, "");
  const r = (siteRel: string) => (o.dynamicBase ? siteRel : relativeUrl(o.dir, siteRel));
  const docsRoot = r("docs/");
  const image = `${SITE_URL}/og.png`;
  const meta = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`,
    o.dynamicBase ? `<script>${BASE_INIT}</script>` : "",
    `<title>${esc(o.title)}</title>`,
    `<meta name="description" content="${esc(o.description)}">`,
    o.canonical ? `<link rel="canonical" href="${esc(o.canonical)}">` : "",
    o.markdown
      ? `<link rel="alternate" type="text/markdown" href="${esc(r(o.markdown))}" title="This page as Markdown">`
      : "",
    `<link rel="alternate" type="text/plain" href="${esc(r("llms.txt"))}" title="llms.txt">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="shelf">`,
    `<meta property="og:title" content="${esc(o.title)}">`,
    `<meta property="og:description" content="${esc(o.description)}">`,
    o.canonical ? `<meta property="og:url" content="${esc(o.canonical)}">` : "",
    `<meta property="og:image" content="${image}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(o.title)}">`,
    `<meta name="twitter:description" content="${esc(o.description)}">`,
    `<meta name="twitter:image" content="${image}">`,
    `<meta name="theme-color" content="#0d0b09" media="(prefers-color-scheme: dark)">`,
    `<meta name="theme-color" content="#f7f3ea" media="(prefers-color-scheme: light)">`,
    `<script>${THEME_INIT}</script>`,
    `<link rel="preload" href="${r("fonts/inter.woff2")}" as="font" type="font/woff2" crossorigin>`,
    `<link rel="stylesheet" href="${r("tokens.css")}">`,
    `<link rel="stylesheet" href="${r(o.assets.css)}">`,
    `<link rel="icon" href="${r("brand/icon.svg")}" type="image/svg+xml">`,
    `<link rel="apple-touch-icon" href="${r("brand/apple-touch-icon.png")}">`,
    ...o.jsonLd.map(
      (data) =>
        `<script type="application/ld+json">${JSON.stringify(data).replaceAll("<", "\\u003c")}</script>`,
    ),
    `<script src="${r(o.assets.js)}" defer></script>`,
  ].filter(Boolean);

  return `<!doctype html>
<html lang="en" data-theme="dark" data-docs-root="${esc(docsRoot)}" data-site-root="${esc(root || "./")}">
<head>
${meta.join("\n")}
</head>
<body class="${o.bodyClass}">
<a class="skip-link" href="#content">Skip to content</a>
${topbar(r)}
<div class="layout">
${sidebar(o.docs, o.active, r)}
<div class="scrim" data-close-sidebar hidden></div>
<main id="content" class="main" tabindex="-1">
${o.main}
</main>
${o.rail}
</div>
${searchDialog()}
</body>
</html>
`;
}

function topbar(r: (siteRel: string) => string): string {
  return `<header class="topbar">
  <div class="topbar-inner">
    <button type="button" class="icon-button menu-button" data-open-sidebar aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false">${icons.menu}</button>
    <a class="brand" href="${r("docs/")}" aria-label="shelf docs home">
      <img class="brand-mark" src="${r("brand/logo.svg")}" width="32" height="32" alt="">
      <span class="brand-name">shelf</span>
      <span class="brand-slash" aria-hidden="true">/</span>
      <span class="brand-section">Docs</span>
    </a>
    <button type="button" class="search-trigger" data-open-search aria-label="Search docs" aria-haspopup="dialog">
      ${icons.search}
      <span class="search-trigger-label">Search docs</span>
      <kbd class="search-trigger-kbd"><span data-mod-key>Ctrl</span> K</kbd>
    </button>
    <nav class="topbar-links" aria-label="Site">
      <a href="${r("")}">Website</a>
      <a href="${REPO_URL}" rel="noopener">GitHub</a>
      <a href="${r("llms.txt")}">llms.txt</a>
    </nav>
    <button type="button" class="icon-button search-icon" data-open-search aria-label="Search docs">${icons.search}</button>
    <button type="button" class="icon-button theme-toggle" data-theme-toggle aria-label="Switch to light theme" title="Toggle theme">
      <span class="theme-icon-dark">${icons.moon}</span><span class="theme-icon-light">${icons.sun}</span>
    </button>
  </div>
</header>`;
}

/** Sidebar label: "shelf borrow" shows as `borrow` in a CLI group. */
function navLabel(title: string, path: string): { text: string; mono: boolean } {
  if (path.startsWith("cli/") && /^shelf /.test(title)) {
    return { text: title.slice("shelf ".length), mono: true };
  }
  return { text: title, mono: false };
}

/** Groups longer than this start collapsed unless they hold the current page. */
const COLLAPSE_OVER = 10;

function sidebar(docs: Docs, active: string | null, r: (siteRel: string) => string): string {
  const groups = docs.nav
    .map(({ group, pages }) => {
      const items = pages
        .map((path) => docs.pages.get(path))
        .filter((page): page is DocPage => page !== undefined)
        .map((page) => {
          const current = page.path === active;
          const label = navLabel(page.title, page.path);
          return `<li><a href="${r(pageDir(page.path))}"${current ? ' aria-current="page"' : ""}${label.mono ? ' class="mono"' : ""}>${esc(label.text)}</a></li>`;
        })
        .join("");
      const holdsActive = pages.includes(active ?? "");
      const open = pages.length <= COLLAPSE_OVER || holdsActive;
      return `<details class="nav-group"${open ? " open" : ""}>
  <summary><span>${esc(group)}</span><span class="nav-count">${pages.length > COLLAPSE_OVER ? pages.length : ""}</span>${icons.chevronDown}</summary>
  <ul>${items}</ul>
</details>`;
    })
    .join("\n");
  return `<aside class="sidebar" id="sidebar" aria-label="Docs navigation">
  <div class="sidebar-head">
    <span class="sidebar-title">Docs</span>
    <button type="button" class="icon-button" data-close-sidebar aria-label="Close navigation">${icons.close}</button>
  </div>
  <nav class="sidebar-nav">
    <a class="nav-home" href="${r("docs/")}"${active === "index" ? ' aria-current="page"' : ""}>Overview</a>
${groups}
  </nav>
  <div class="sidebar-links">
    <a href="${r("")}">Website</a>
    <a href="${REPO_URL}" rel="noopener">GitHub ${icons.external}</a>
    <a href="${r("llms.txt")}">llms.txt</a>
  </div>
</aside>`;
}

function searchDialog(): string {
  return `<dialog class="search-dialog" aria-label="Search docs">
  <div class="search-panel">
    <div class="search-field">
      ${icons.search}
      <input type="search" class="search-input" placeholder="Search docs, commands, flags…" aria-label="Search docs" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="search-results" aria-autocomplete="list">
      <button type="button" class="search-close" data-close-search aria-label="Close search"><kbd>Esc</kbd></button>
    </div>
    <ul class="search-results" id="search-results" role="listbox" aria-label="Results"></ul>
    <div class="search-foot" aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>↵</kbd> to open</span><span><kbd>Esc</kbd> to close</span></div>
  </div>
</dialog>`;
}

// ---------------------------------------------------------------------------
// Pages

function toc(headings: readonly Heading[], className: string): string {
  if (headings.length < 2) return "";
  const items = headings
    .map(
      (h) =>
        `<li class="toc-depth-${h.depth}"><a href="#${esc(h.id)}" data-toc-link="${esc(h.id)}">${esc(h.text)}</a></li>`,
    )
    .join("");
  return `<ul class="${className}">${items}</ul>`;
}

function copyMenu(page: DocPage, dir: string): string {
  const mdUrl = absoluteUrl(pageMarkdown(page.path));
  const prompt = `Read ${mdUrl} and answer questions about shelf`;
  const md = relativeUrl(dir, pageMarkdown(page.path));
  const llmsFull = relativeUrl(dir, "llms-full.txt");
  return `<div class="copy-page" data-markdown="${esc(md)}">
  <button type="button" class="copy-page-main" data-copy-page>${icons.copy}<span>Copy Markdown</span></button>
  <button type="button" class="copy-page-toggle" aria-label="More ways to use this page" aria-haspopup="menu" aria-expanded="false" data-copy-menu-toggle>${icons.chevronDown}</button>
  <div class="copy-menu" role="menu" hidden>
    <a role="menuitem" href="${esc(md)}" target="_blank" rel="noopener">${icons.markdown}<span><strong>View as Markdown</strong><small>Open the plain-text page</small></span></a>
    <a role="menuitem" href="https://chatgpt.com/?hints=search&amp;q=${encodeURIComponent(prompt)}" target="_blank" rel="noopener">${icons.chat}<span><strong>Open in ChatGPT</strong><small>Ask questions about this page</small></span></a>
    <a role="menuitem" href="https://claude.ai/new?q=${encodeURIComponent(prompt)}" target="_blank" rel="noopener">${icons.chat}<span><strong>Open in Claude</strong><small>Ask questions about this page</small></span></a>
    <a role="menuitem" href="${esc(llmsFull)}" target="_blank" rel="noopener">${icons.file}<span><strong>llms-full.txt</strong><small>Every docs page in one file</small></span></a>
  </div>
</div>`;
}

function pager(prev: Link | null, next: Link | null, dir: string): string {
  if (!prev && !next) return "";
  const item = (link: Link, rel: "prev" | "next") =>
    `<a class="pager-${rel}" href="${relativeUrl(dir, pageDir(link.path))}" rel="${rel}">
      <span class="pager-label">${rel === "prev" ? `${icons.arrowLeft} Previous` : `Next ${icons.arrowRight}`}</span>
      <span class="pager-title">${esc(link.title)}</span>
    </a>`;
  return `<nav class="pager" aria-label="Previous and next pages">${prev ? item(prev, "prev") : "<span></span>"}${next ? item(next, "next") : ""}</nav>`;
}

function breadcrumbLd(items: readonly { name: string; url: string }[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

const AUTHOR = { "@type": "Person", name: "limyuquan", url: "https://github.com/limyuquan" };

export function renderDocPage(docs: Docs, assets: Assets, view: PageView): string {
  const { page } = view;
  const dir = pageDir(page.path);
  const canonical = absoluteUrl(dir);
  const sourcePath = `docs/${page.path}.md`;
  const issueUrl = `${REPO_URL}/issues/new?title=${encodeURIComponent(`Docs: ${page.title}`)}&body=${encodeURIComponent(`Page: ${canonical}\n\n`)}`;
  const group = page.group ?? "Docs";
  const description = page.summary || TAGLINE;

  const main = `<div class="page-grid">
<article class="page">
  <nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="${relativeUrl(dir, "docs/")}">Docs</a></li><li aria-current="location">${esc(group)}</li></ol></nav>
  <header class="page-header">
    <div class="page-title-row">
      <h1>${esc(page.title)}</h1>
      ${copyMenu(page, dir)}
    </div>
    ${view.ledeHtml ? `<p class="lede">${view.ledeHtml}</p>` : ""}
  </header>
  ${
    view.headings.length >= 2
      ? `<details class="toc-mobile"><summary>On this page ${icons.chevronDown}</summary>${toc(view.headings, "toc-list")}</details>`
      : ""
  }
  <div class="prose">
${view.bodyHtml}
  </div>
  <footer class="page-footer">
    <div class="page-actions">
      <a href="${REPO_URL}/edit/main/${sourcePath}" rel="noopener">${icons.edit} Edit this page on GitHub</a>
      <a href="${esc(issueUrl)}" rel="noopener">${icons.issue} Open an issue</a>
    </div>
    ${pager(view.prev, view.next, dir)}
  </footer>
</article>
</div>`;

  const rail = `<aside class="rail" aria-label="On this page">
  ${view.headings.length >= 2 ? `<p class="rail-title">On this page</p>${toc(view.headings, "toc-list")}` : ""}
  <div class="rail-links">
    <a href="${relativeUrl(dir, pageMarkdown(page.path))}">${icons.markdown} View as Markdown</a>
    <a href="#content" data-back-to-top>${icons.arrowLeft} Back to top</a>
  </div>
</aside>`;

  return shell({
    docs,
    assets,
    dir,
    active: page.path,
    title: `${page.title} · shelf docs`,
    description,
    canonical,
    markdown: pageMarkdown(page.path),
    bodyClass: "doc",
    main,
    rail,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        headline: page.title,
        description,
        url: canonical,
        inLanguage: "en",
        author: AUTHOR,
        isPartOf: { "@type": "WebSite", name: "shelf", url: `${SITE_URL}/` },
        about: {
          "@type": "SoftwareApplication",
          name: "shelf",
          applicationCategory: "DeveloperApplication",
        },
      },
      breadcrumbLd([
        { name: "Docs", url: absoluteUrl("docs/") },
        ...(page.group ? [{ name: page.group, url: canonical }] : []),
        { name: page.title, url: canonical },
      ]),
    ],
  });
}

/** Book-spine accents for the home page's groups, in the logo's order. */
const SPINES = ["violet", "teal", "amber", "coral"];

export function renderHome(docs: Docs, assets: Assets, view: HomeView): string {
  const dir = "docs/";
  const r = (siteRel: string) => relativeUrl(dir, siteRel);
  const groups = docs.nav
    .map(({ group, pages }, index) => {
      const list = pages
        .filter((path) => path !== "index")
        .map((path) => docs.pages.get(path))
        .filter((page): page is DocPage => page !== undefined);
      if (list.length === 0) return "";
      const spine = SPINES[index % SPINES.length];
      const compact = list.length > 12;
      const cards = list
        .map((page) => {
          const label = navLabel(page.title, page.path);
          return compact
            ? `<li><a class="chip" href="${r(pageDir(page.path))}" title="${esc(page.summary)}"><span${label.mono ? ' class="mono"' : ""}>${esc(label.text)}</span></a></li>`
            : `<li><a class="card" href="${r(pageDir(page.path))}"><span class="card-title">${esc(page.title)}</span><span class="card-text">${esc(page.summary)}</span></a></li>`;
        })
        .join("");
      return `<section class="home-group spine-${spine}" aria-labelledby="group-${index}">
  <h2 id="group-${index}"><span class="spine" aria-hidden="true"></span>${esc(group)}</h2>
  <ul class="${compact ? "chips" : "cards"}">${cards}</ul>
</section>`;
    })
    .join("\n");

  const buttons = [
    view.start
      ? `<a class="button button-primary" href="${r(pageDir(view.start.path))}">Get started ${icons.arrowRight}</a>`
      : "",
    view.cli ? `<a class="button" href="${r(pageDir(view.cli.path))}">CLI reference</a>` : "",
    `<a class="button" href="${REPO_URL}" rel="noopener">${icons.github} GitHub</a>`,
  ].join("");

  const llmsUrl = `${SITE_URL}/llms.txt`;
  const main = `<div class="home">
  <section class="home-hero">
    <div class="home-hero-text">
      <p class="eyebrow">Documentation</p>
      <h1>${esc(view.title)}</h1>
      <p class="lede">${view.ledeHtml}</p>
      <div class="home-buttons">${buttons}</div>
    </div>
    <div class="home-hero-code">${view.terminalHtml}</div>
  </section>
  <section class="agent-strip" aria-label="For agents">
    <span class="agent-strip-label">For agents</span>
    <code class="agent-strip-url">${llmsUrl}</code>
    <button type="button" class="agent-strip-copy" data-copy-text="${esc(llmsUrl)}" aria-label="Copy the llms.txt URL">${icons.copy}<span>Copy</span></button>
    <span class="agent-strip-note">Every page is also Markdown: add <code>.md</code> to its URL.</span>
  </section>
  ${view.introHtml ? `<div class="prose home-intro">${view.introHtml}</div>` : ""}
${groups}
</div>`;

  return shell({
    docs,
    assets,
    dir,
    active: "index",
    title: `${view.title} · shelf docs`,
    description: view.summary || TAGLINE,
    canonical: absoluteUrl(dir),
    markdown: docs.home ? pageMarkdown("index") : null,
    bodyClass: "doc doc-home",
    main,
    rail: "",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "shelf docs",
        url: absoluteUrl(dir),
        description: view.summary || TAGLINE,
        author: AUTHOR,
      },
    ],
  });
}

export function render404(docs: Docs, assets: Assets): string {
  const main = `<div class="not-found">
  <p class="eyebrow">404</p>
  <h1>This page is out on loan</h1>
  <p class="lede">Nothing lives at this address. It may have moved, or the link may be wrong.</p>
  <div class="home-buttons">
    <a class="button button-primary" href="docs/">Docs home</a>
    <button type="button" class="button" data-open-search>${icons.search} Search the docs</button>
    <a class="button" href="./">Website</a>
  </div>
</div>`;
  return shell({
    docs,
    assets,
    dir: "",
    active: null,
    title: "Page not found · shelf",
    description: TAGLINE,
    canonical: null,
    markdown: null,
    bodyClass: "doc doc-404",
    main,
    rail: "",
    jsonLd: [],
    dynamicBase: true,
  });
}
