/**
 * Reads a docs directory (docs/ for the site, or the fixtures in tests) into pages.
 *
 *   <dir>/nav.json        [{ "group": "Getting started", "pages": ["introduction", "cli/borrow"] }]
 *   <dir>/<path>.md       a page: "# Title", a blank line, a one-paragraph description, the body
 *   <dir>/index.md        the docs home (title, description, optional intro); not in nav
 *   <dir>/llms.md         the preamble of /llms.txt; not a page
 *
 * Every other .md file is rendered too (unlisted: no sidebar entry), so links to
 * it work. The docs directory is treated as `docs/` in the repository whatever its
 * real location, so the fixtures resolve repository links the way docs/ does.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix, relative, resolve } from "node:path";
import { fillGenerated } from "./generate.ts";

export const ROOT = resolve(import.meta.dir, "../..");
export const SITE_URL = "https://limyuquan.github.io/shelf";
export const REPO_URL = "https://github.com/limyuquan/shelf";
/** Where the docs live in the repository (for GitHub links). */
export const DOCS_REPO_PATH = "docs";

export interface NavGroup {
  readonly group: string;
  readonly pages: readonly string[];
}

export interface DocPage {
  /** Docs path without `.md`, e.g. `cli/borrow`; `index` is the docs home. */
  readonly path: string;
  readonly file: string;
  /** The file as committed. */
  readonly source: string;
  /** With generated blocks filled from the code. */
  readonly markdown: string;
  readonly title: string;
  /** Markdown of the description paragraph ("" when the page has none). */
  readonly description: string;
  /** The description as plain text, for meta tags and search. */
  readonly summary: string;
  /** Everything after the description. */
  readonly body: string;
  /** Nav group, or null for an unlisted page. */
  readonly group: string | null;
  readonly blocks: readonly string[];
}

export interface Docs {
  readonly dir: string;
  readonly nav: readonly NavGroup[];
  readonly hasNav: boolean;
  /** Every page by path, including the home and unlisted pages. */
  readonly pages: ReadonlyMap<string, DocPage>;
  /** Nav pages in nav order (pages that exist). */
  readonly ordered: readonly DocPage[];
  readonly home: DocPage | null;
  readonly preamble: string | null;
  /** Problems the build tolerates but the docs test does not. */
  readonly warnings: readonly string[];
}

export function loadDocs(dir: string): Docs {
  const warnings: string[] = [];
  const files = listMarkdown(dir).filter((path) => path !== "llms");
  const navFile = join(dir, "nav.json");
  const hasNav = existsSync(navFile);
  const nav: NavGroup[] = hasNav
    ? (JSON.parse(readFileSync(navFile, "utf8")) as NavGroup[])
    : [{ group: "Docs", pages: files.filter((path) => path !== "index") }];
  if (!hasNav) warnings.push(`${navFile} is missing; listing every page in one group`);

  const groupOf = new Map<string, string>();
  for (const { group, pages } of nav) {
    for (const path of pages) {
      if (groupOf.has(path)) warnings.push(`nav.json lists "${path}" twice`);
      groupOf.set(path, group);
      if (!files.includes(path))
        warnings.push(`nav.json lists "${path}", but ${path}.md does not exist`);
    }
  }

  const pages = new Map<string, DocPage>();
  for (const path of files) {
    const page = readPage(dir, path, groupOf.get(path) ?? null);
    if (!splitPage(page.markdown).title) warnings.push(`${path}.md does not start with "# Title"`);
    if (!page.description && path !== "index" && groupOf.has(path)) {
      warnings.push(`${path}.md has no description paragraph after its title`);
    }
    pages.set(path, page);
  }

  const ordered = nav.flatMap(({ pages: paths }) =>
    paths.flatMap((path) =>
      path !== "index" && pages.has(path) ? [pages.get(path) as DocPage] : [],
    ),
  );
  const llms = join(dir, "llms.md");
  return {
    dir,
    nav,
    hasNav,
    pages,
    ordered,
    home: pages.get("index") ?? null,
    preamble: existsSync(llms) ? readFileSync(llms, "utf8").trim() : null,
    warnings,
  };
}

function listMarkdown(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listMarkdown(dir, rel));
    else if (entry.name.endsWith(".md")) out.push(rel.slice(0, -3));
  }
  return out;
}

export function readPage(dir: string, path: string, group: string | null): DocPage {
  const file = join(dir, `${path}.md`);
  const source = readFileSync(file, "utf8");
  const { markdown, blocks } = fillGenerated(source, path);
  const { title, description, body } = splitPage(markdown);
  return {
    path,
    file,
    source,
    markdown,
    title: title || path,
    description,
    summary: plainText(description),
    body,
    group,
    blocks,
  };
}

/** "# Title", blank line, description paragraph, then the body. */
export function splitPage(markdown: string): { title: string; description: string; body: string } {
  const lines = markdown.replace(/^﻿/, "").split("\n");
  let i = 0;
  while (i < lines.length && !lines[i]?.trim()) i++;
  const heading = lines[i]?.match(/^#\s+(.+?)\s*#*\s*$/);
  if (!heading) return { title: "", description: "", body: markdown };
  i++;
  while (i < lines.length && !lines[i]?.trim()) i++;
  const start = i;
  while (i < lines.length && lines[i]?.trim()) i++;
  const paragraph = lines.slice(start, i);
  const isProse =
    paragraph.length > 0 &&
    !/^(#|```|~~~|\||[-*+] |\d+\. |>|<|!\[)/.test(paragraph[0]?.trimStart() ?? "");
  return isProse
    ? {
        title: heading[1] ?? "",
        description: paragraph.join(" ").trim(),
        body: lines.slice(i).join("\n").trim(),
      }
    : { title: heading[1] ?? "", description: "", body: lines.slice(start).join("\n").trim() };
}

/** Markdown inline text to plain text (links keep their text). */
export function plainText(markdown: string): string {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .split(/(`[^`]*`)/)
    .map((part, index) =>
      // Code spans keep everything (`<skill>`); elsewhere drop HTML tags and emphasis.
      index % 2 === 1
        ? part.slice(1, -1)
        : part.replace(/<[^>]+>/g, "").replace(/(\*\*|__|\*|`)/g, ""),
    )
    .join("")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\\([|\\`*_])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// URLs

/** The site-root-relative directory of a page: `docs/cli/borrow/`, `docs/` for the home. */
export function pageDir(path: string): string {
  if (path === "index") return "docs/";
  if (path.endsWith("/index")) return `docs/${path.slice(0, -"/index".length)}/`;
  return `docs/${path}/`;
}

/** The site-root-relative `.md` of a page: `docs/cli/borrow.md`. */
export function pageMarkdown(path: string): string {
  return `docs/${path}.md`;
}

/** A relative URL from a directory (ending in "/") to a site-root-relative target. */
export function relativeUrl(fromDir: string, to: string): string {
  const trailing = to.endsWith("/") || to === "";
  const rel = posix.relative(fromDir.replace(/\/$/, "") || ".", to.replace(/\/$/, "") || ".");
  if (!rel) return "./";
  return trailing ? `${rel}/` : rel;
}

export const absoluteUrl = (siteRel: string) => `${SITE_URL}/${siteRel}`;

// ---------------------------------------------------------------------------
// Links

export type ResolvedLink =
  | { readonly kind: "external"; readonly href: string }
  | { readonly kind: "anchor"; readonly hash: string }
  | { readonly kind: "page"; readonly path: string; readonly hash: string }
  /** A file in the docs directory (an image), copied to /docs/<docsPath>. */
  | {
      readonly kind: "asset";
      readonly docsPath: string;
      readonly file: string;
      readonly hash: string;
    }
  /** A file the site publishes elsewhere: assets/media → /media, assets/brand → /brand. */
  | {
      readonly kind: "site";
      readonly siteRel: string;
      readonly hash: string;
      /** False until the file lands (media are made separately): a warning, not an error. */
      readonly exists: boolean;
    }
  | {
      readonly kind: "repo";
      readonly repoPath: string;
      readonly dir: boolean;
      readonly hash: string;
    }
  | { readonly kind: "missing"; readonly target: string; readonly hash: string };

const SITE_DIRS: readonly [string, string][] = [
  ["assets/media/", "media/"],
  ["assets/brand/", "brand/"],
];

/** Resolves a link written in page `from` (a docs path) the way GitHub would. */
export function resolveLink(docs: Docs, from: string, href: string): ResolvedLink {
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(href)) return { kind: "external", href };
  if (href.startsWith("#")) return { kind: "anchor", hash: href.slice(1) };
  const [rawPath = "", hash = ""] = href.split("#", 2) as [string, string?];
  const target = decodeURI(rawPath.split("?")[0] ?? "");
  const repoPath = posix.normalize(
    target.startsWith("/")
      ? target.slice(1)
      : posix.join(DOCS_REPO_PATH, posix.dirname(from), target),
  );
  const inDocs = repoPath === DOCS_REPO_PATH || repoPath.startsWith(`${DOCS_REPO_PATH}/`);
  const docsPath = inDocs ? repoPath.slice(DOCS_REPO_PATH.length + 1) : null;

  if (docsPath?.endsWith(".md")) {
    const path = docsPath.slice(0, -3);
    return docs.pages.has(path)
      ? { kind: "page", path, hash }
      : { kind: "missing", target: href, hash };
  }
  if (docsPath !== null) {
    const file = join(docs.dir, docsPath);
    if (docsPath && existsSync(file) && statSync(file).isFile()) {
      return { kind: "asset", docsPath, file, hash };
    }
    // A directory in docs/ (or docs/ itself): its index page if there is one.
    const index = docsPath ? `${docsPath.replace(/\/$/, "")}/index` : "index";
    if (docs.pages.has(index)) return { kind: "page", path: index, hash };
    return { kind: "missing", target: href, hash };
  }
  for (const [prefix, siteDir] of SITE_DIRS) {
    if (repoPath.startsWith(prefix)) {
      return {
        kind: "site",
        siteRel: siteDir + repoPath.slice(prefix.length),
        hash,
        exists: existsSync(join(ROOT, repoPath)),
      };
    }
  }
  const onDisk = join(ROOT, repoPath);
  if (!existsSync(onDisk)) return { kind: "missing", target: href, hash };
  return { kind: "repo", repoPath, dir: statSync(onDisk).isDirectory(), hash };
}

const withHash = (url: string, hash: string) => (hash ? `${url}#${hash}` : url);

export function githubUrl(repoPath: string, dir = false, hash = ""): string {
  return withHash(`${REPO_URL}/${dir ? "tree" : "blob"}/main/${repoPath}`, hash);
}

/** Where a link points in the HTML of the page at `fromDir`. */
export function htmlHref(link: ResolvedLink, fromDir: string, from: string): string {
  switch (link.kind) {
    case "external":
      return link.href;
    case "anchor":
      return `#${link.hash}`;
    case "page":
      return withHash(relativeUrl(fromDir, pageDir(link.path)), link.hash);
    case "asset":
      return withHash(relativeUrl(fromDir, `docs/${link.docsPath}`), link.hash);
    case "site":
      return withHash(relativeUrl(fromDir, link.siteRel), link.hash);
    case "repo":
      return githubUrl(link.repoPath, link.dir, link.hash);
    case "missing":
      return githubUrl(
        posix.join(DOCS_REPO_PATH, posix.dirname(from), link.target.split("#")[0] ?? ""),
      );
  }
}

/** Where a link points in the published `.md` (absolute, so an agent can follow it). */
export function markdownHref(link: ResolvedLink, from: string): string {
  switch (link.kind) {
    case "external":
      return link.href;
    case "anchor":
      return withHash(absoluteUrl(pageMarkdown(from)), link.hash);
    case "page":
      return withHash(absoluteUrl(pageMarkdown(link.path)), link.hash);
    case "asset":
      return withHash(absoluteUrl(`docs/${link.docsPath}`), link.hash);
    case "site":
      return withHash(absoluteUrl(link.siteRel), link.hash);
    case "repo":
      return githubUrl(link.repoPath, link.dir, link.hash);
    case "missing":
      return githubUrl(
        posix.join(DOCS_REPO_PATH, posix.dirname(from), link.target.split("#")[0] ?? ""),
      );
  }
}

/**
 * Rewrites the targets of Markdown links and images outside code (inline links
 * and reference definitions). `strip` drops images entirely, for llms-full.txt.
 */
export function rewriteMarkdownLinks(
  markdown: string,
  rewrite: (href: string) => string,
  options: { stripImages?: boolean } = {},
): string {
  return splitCode(markdown)
    .map(({ code, text }) => {
      if (code) return text;
      let out = text;
      if (options.stripImages) out = out.replace(/!\[[^\]]*\]\([^)]*\)\s?/g, "");
      out = out.replace(
        /(!?\[(?:[^\]\\]|\\.)*\]\()(<[^>]+>|[^)\s]+)((?:\s+"[^"]*")?\))/g,
        (_, open: string, href: string, close: string) => {
          const bare = href.startsWith("<") ? href.slice(1, -1) : href;
          return `${open}${rewrite(bare)}${close}`;
        },
      );
      out = out.replace(/^(\s{0,3}\[[^\]]+\]:\s+)(\S+)/gm, (_, open: string, href: string) => {
        return `${open}${rewrite(href)}`;
      });
      out = out.replace(/\b(src|href|poster)="([^"]+)"/g, (_, attr: string, href: string) => {
        return `${attr}="${rewrite(href)}"`;
      });
      return out;
    })
    .join("");
}

/** Splits Markdown into fenced/inline code and the rest. */
function splitCode(markdown: string): { code: boolean; text: string }[] {
  const parts: { code: boolean; text: string }[] = [];
  const pattern = /(^ {0,3}(```|~~~)[^\n]*\n[\s\S]*?^ {0,3}\2[^\n]*$|`+[^`\n]*?`+)/gm;
  let last = 0;
  for (const match of markdown.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ code: false, text: markdown.slice(last, index) });
    parts.push({ code: true, text: match[0] });
    last = index + match[0].length;
  }
  if (last < markdown.length) parts.push({ code: false, text: markdown.slice(last) });
  return parts;
}

/** The docs dir relative to the repository root, for messages. */
export const displayPath = (file: string) => relative(ROOT, file) || ".";
