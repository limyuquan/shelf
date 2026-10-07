/**
 * Markdown → HTML for docs pages, at build time (marked + shiki).
 *
 * Supported beyond GitHub-flavoured Markdown, all of which also render on GitHub:
 * - Heading anchors with GitHub's ids, so `page.md#some-heading` works in both places.
 * - Callouts with GitHub's alert syntax, as the first line of a blockquote:
 *     > [!NOTE]        (also [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION])
 *     > Loans you keep never expire.
 * - Shell sessions: ```console blocks (or ```sh with "$ " prompts). The prompt is
 *   not selectable, output lines are dimmed, and Copy copies only the commands.
 * - Relative links: `other.md`, `../cli/borrow.md#options` become site links;
 *   links to repository files outside docs/ go to GitHub; images under docs/ are
 *   copied, and `../assets/media/…` resolves to the site's /media/.
 */
import { Marked, type Token, type Tokens } from "marked";
import {
  type DocPage,
  type Docs,
  htmlHref,
  pageDir,
  plainText,
  type ResolvedLink,
  resolveLink,
} from "./docs.ts";
import { highlightBlock } from "./highlight.ts";

export interface Heading {
  readonly depth: number;
  readonly id: string;
  readonly text: string;
}

export interface Section {
  /** Heading id, or "" for the text before the first heading. */
  readonly id: string;
  readonly heading: string;
  readonly text: string;
  /** Inline code in the section (command names, flags), for search. */
  readonly keywords: readonly string[];
}

export interface Rendered {
  readonly html: string;
  readonly headings: readonly Heading[];
  /** Every heading id (all levels), for anchor checks. */
  readonly ids: readonly string[];
  readonly sections: readonly Section[];
  /** Every link in the page, for the docs test. */
  readonly links: readonly ResolvedLink[];
  /** Files under docs/ the page uses, to copy to the output. */
  readonly assets: readonly string[];
}

/** GitHub's heading ids (github-slugger): lowercase, punctuation dropped, spaces to hyphens. */
export function createSlugger(): (text: string) => string {
  const seen = new Map<string, number>();
  return (text) => {
    const base = text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
      .replace(/ /g, "-");
    let slug = base;
    while (seen.has(slug)) {
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      slug = `${base}-${n}`;
    }
    seen.set(slug, 0);
    return slug;
  };
}

const escapeHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const ALERTS: Record<string, string> = {
  NOTE: "Note",
  TIP: "Tip",
  IMPORTANT: "Important",
  WARNING: "Warning",
  CAUTION: "Caution",
};

type HeadingToken = Tokens.Heading & { id?: string };
type QuoteToken = Tokens.Blockquote & { alert?: string };

/** Plain text of inline tokens, as GitHub uses for heading ids. */
function inlineText(tokens: readonly Token[] | undefined): string {
  return (tokens ?? [])
    .map((token) => {
      if ("tokens" in token && token.tokens) return inlineText(token.tokens);
      if (token.type === "html") return "";
      return "text" in token ? String(token.text) : "";
    })
    .join("");
}

const decodeEntities = (text: string) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

/** Renders Markdown written in page `path` (the body, or a fragment such as the home intro). */
export function renderMarkdown(docs: Docs, path: string, markdown: string): Rendered {
  const slug = createSlugger();
  const fromDir = pageDir(path);
  const headings: Heading[] = [];
  const ids: string[] = [];
  const links: ResolvedLink[] = [];
  const assets = new Set<string>();

  const href = (raw: string) => {
    const link = resolveLink(docs, path, decodeEntities(raw));
    links.push(link);
    if (link.kind === "asset") assets.add(link.docsPath);
    return htmlHref(link, fromDir, path);
  };

  const marked = new Marked({
    gfm: true,
    async: false,
    renderer: {
      heading(token) {
        const { tokens, depth } = token;
        const id = (token as HeadingToken).id ?? slug(inlineText(tokens));
        const inner = this.parser.parseInline(tokens);
        ids.push(id);
        if (depth === 2 || depth === 3) {
          headings.push({ depth, id, text: decodeEntities(inlineText(tokens)) });
        }
        return `<h${depth} id="${escapeHtml(id)}">${inner}<a class="anchor" href="#${escapeHtml(id)}" aria-label="Link to this section"></a></h${depth}>\n`;
      },
      link({ href: raw, title, tokens }) {
        const inner = this.parser.parseInline(tokens);
        const target = href(raw);
        const external = /^https?:/.test(target) ? ' rel="noopener"' : "";
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
        return `<a href="${escapeHtml(target)}"${titleAttr}${external}>${inner}</a>`;
      },
      image({ href: raw, title, text }) {
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
        return `<img src="${escapeHtml(href(raw))}" alt="${escapeHtml(text)}"${titleAttr} loading="lazy" decoding="async">`;
      },
      code({ text, lang }) {
        return `${highlightBlock(text, lang).html}\n`;
      },
      blockquote(token) {
        const alert = (token as QuoteToken).alert;
        const inner = this.parser.parse(token.tokens);
        if (!alert) return `<blockquote>${inner}</blockquote>\n`;
        const kind = alert.toLowerCase();
        return `<aside class="callout callout-${kind}" role="note"><p class="callout-title">${ALERTS[alert]}</p>${inner}</aside>\n`;
      },
      html({ text }) {
        const withoutComments = text.replace(/<!--[\s\S]*?-->/g, "");
        for (const match of withoutComments.matchAll(/\bid="([^"]+)"/g)) ids.push(match[1] ?? "");
        return withoutComments.replace(
          /\b(src|href|poster)="([^"#][^"]*)"/g,
          (_, attr: string, value: string) => `${attr}="${escapeHtml(href(value))}"`,
        );
      },
      table(token) {
        // The default table, in a wrapper that scrolls sideways on narrow screens.
        const cell = (c: Tokens.TableCell, tag: "th" | "td") => {
          const align = c.align ? ` style="text-align:${c.align}"` : "";
          return `<${tag}${align}>${this.parser.parseInline(c.tokens)}</${tag}>`;
        };
        const head = `<tr>${token.header.map((c) => cell(c, "th")).join("")}</tr>`;
        const rows = token.rows.map((row) => `<tr>${row.map((c) => cell(c, "td")).join("")}</tr>`);
        return `<div class="table-wrap" tabindex="0"><table><thead>${head}</thead><tbody>${rows.join("")}</tbody></table></div>\n`;
      },
    },
  });

  const tokens = marked.lexer(markdown);
  marked.walkTokens(tokens, (token) => {
    // Heading ids are assigned in document order before rendering, so the
    // search sections and the rendered anchors agree.
    if (token.type === "heading") {
      const heading = token as HeadingToken;
      heading.id ??= slug(decodeEntities(inlineText(heading.tokens)));
    }
    if (token.type === "blockquote") markAlert(token as QuoteToken);
  });
  const sections = collectSections(tokens);
  const html = marked.parser(tokens);
  return { html, headings, ids, sections, links, assets: [...assets] };
}

/** `> [!NOTE]` on a blockquote's first line marks it as a callout. */
function markAlert(token: QuoteToken): void {
  if (token.alert !== undefined) return;
  const first = token.tokens[0];
  if (first?.type !== "paragraph") return;
  const match = first.text.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(\n|$)/);
  if (!match) {
    token.alert = "";
    return;
  }
  token.alert = match[1] ?? "NOTE";
  const marker = match[0];
  const paragraph = first as Tokens.Paragraph;
  paragraph.text = paragraph.text.slice(marker.length);
  const lead = paragraph.tokens[0];
  if (lead && "text" in lead && typeof lead.text === "string") {
    const stripped = lead.text.replace(/^\[!\w+\][ \t]*\n?/, "");
    if (stripped.length === lead.text.length) {
      // The marker was split across tokens ("[", "!NOTE", "]"); drop until "]" is consumed.
      let consumed = 0;
      while (paragraph.tokens.length > 0 && consumed < marker.trimEnd().length) {
        const next = paragraph.tokens.shift() as Token;
        consumed += "raw" in next ? next.raw.length : 0;
      }
    } else {
      (lead as Tokens.Text).text = stripped;
      (lead as Tokens.Text).raw = stripped;
      delete (lead as { tokens?: unknown }).tokens;
    }
  }
  if (!paragraph.text.trim()) token.tokens.shift();
}

function collectSections(tokens: readonly Token[]): Section[] {
  const sections: Section[] = [];
  let current = { id: "", heading: "", parts: [] as string[], keywords: new Set<string>() };
  const flush = () => {
    const text = current.parts.join(" ").replace(/\s+/g, " ").trim();
    if (text || current.heading) {
      sections.push({
        id: current.id,
        heading: current.heading,
        text,
        keywords: [...current.keywords],
      });
    }
  };
  for (const token of tokens) {
    if (token.type === "heading" && (token as HeadingToken).depth <= 3) {
      flush();
      const heading = token as HeadingToken;
      current = {
        id: heading.id ?? "",
        heading: decodeEntities(inlineText(heading.tokens)),
        parts: [],
        keywords: new Set(),
      };
      for (const code of heading.raw.matchAll(/`([^`]+)`/g)) addKeywords(current.keywords, code[1]);
      continue;
    }
    if (token.type === "space" || token.type === "html") continue;
    if (token.type === "code") {
      // Commands are what people search for; output is noise.
      const commands = (token as Tokens.Code).text
        .split("\n")
        .filter((line) => /^\$ /.test(line) || /^shelf\b/.test(line))
        .map((line) => line.replace(/^\$ /, ""));
      current.parts.push(commands.join(" "));
      for (const command of commands) addKeywords(current.keywords, command);
      continue;
    }
    if (token.type === "table") {
      // Rows only: header cells ("Option", "Type") are noise in a snippet.
      const table = token as Tokens.Table;
      for (const row of table.rows) {
        current.parts.push(`${row.map((cell) => plainText(cell.text)).join(" ")}.`);
      }
    } else {
      current.parts.push(plainText(token.raw.replace(/^#+\s|^>\s?|^\s*[-*+]\s|\[!\w+\]/gm, " ")));
    }
    for (const code of token.raw.matchAll(/`([^`]+)`/g)) addKeywords(current.keywords, code[1]);
  }
  flush();
  return sections;
}

function addKeywords(set: Set<string>, code: string | undefined): void {
  for (const word of (code ?? "").replace(/\\\|/g, " ").split(/[\s,]+/)) {
    const clean = word.replace(/^[<[(]+|[>\]).:;]+$/g, "");
    if (clean.length >= 2 && clean.length <= 40) set.add(clean);
  }
}

/** The page's lede: its description paragraph as inline HTML. */
export function renderInline(docs: Docs, page: DocPage, markdown: string): string {
  const rendered = renderMarkdown(docs, page.path, markdown);
  return rendered.html.replace(/^<p>|<\/p>\s*$/g, "");
}
