/**
 * Build-time syntax highlighting with shiki. Two themes built from the site's
 * palette (site/tokens.css) are emitted together as CSS variables per token
 * (--shiki-dark / --shiki-light); docs.css picks one by data-theme, so the page
 * ships no highlighter.
 *
 * Shell sessions (```console, or ```sh whose lines start with "$ ") render the
 * prompt as a separate, unselectable span and dim the output, and the copy
 * button copies only the commands.
 */
import { createHighlighter, type Highlighter, type ThemeRegistrationRaw } from "shiki";

const LANGS = [
  "shellscript",
  "json",
  "jsonc",
  "typescript",
  "javascript",
  "tsx",
  "yaml",
  "toml",
  "markdown",
  "diff",
  "html",
  "css",
] as const;

const ALIASES: Record<string, string> = {
  sh: "shellscript",
  bash: "shellscript",
  shell: "shellscript",
  zsh: "shellscript",
  ts: "typescript",
  js: "javascript",
  md: "markdown",
  yml: "yaml",
};

const CONSOLE_LANGS = new Set(["console", "shellsession", "terminal"]);
const PLAIN_LANGS = new Set(["", "text", "txt", "plain", "plaintext", "output"]);

interface Palette {
  readonly fg: string;
  readonly bg: string;
  readonly comment: string;
  readonly keyword: string;
  readonly string: string;
  readonly number: string;
  readonly fn: string;
  readonly option: string;
  readonly property: string;
  readonly type: string;
  readonly punctuation: string;
  readonly variable: string;
  readonly inserted: string;
  readonly deleted: string;
}

// The book spines (violet, teal, amber, coral) and wood, tuned for contrast on
// each theme's --code-bg.
const DARK: Palette = {
  fg: "#e9e1d0",
  bg: "#110f0c",
  comment: "#857b6b",
  keyword: "#f0877c",
  string: "#6fcab5",
  number: "#f2b84b",
  fn: "#a9abff",
  option: "#e3b874",
  property: "#b9bbff",
  type: "#e3a56a",
  punctuation: "#a39985",
  variable: "#f1eadb",
  inserted: "#6fcab5",
  deleted: "#f0877c",
};

const LIGHT: Palette = {
  fg: "#2a231c",
  bg: "#f3eee3",
  comment: "#8a8070",
  keyword: "#b3422f",
  string: "#18735f",
  number: "#94600c",
  fn: "#4b4ec4",
  option: "#87561a",
  property: "#4b4ec4",
  type: "#9a5a1c",
  punctuation: "#665c50",
  variable: "#1d1813",
  inserted: "#18735f",
  deleted: "#b3422f",
};

function theme(name: string, type: "dark" | "light", p: Palette): ThemeRegistrationRaw {
  return {
    name,
    type,
    colors: { "editor.background": p.bg, "editor.foreground": p.fg },
    settings: [
      { settings: { foreground: p.fg, background: p.bg } },
      {
        scope: ["comment", "punctuation.definition.comment"],
        settings: { foreground: p.comment, fontStyle: "italic" },
      },
      {
        scope: ["keyword", "storage", "keyword.operator.new", "keyword.control"],
        settings: { foreground: p.keyword },
      },
      { scope: ["keyword.operator", "punctuation"], settings: { foreground: p.punctuation } },
      {
        scope: ["string", "string.quoted", "markup.inline.raw"],
        settings: { foreground: p.string },
      },
      {
        scope: ["constant.numeric", "constant.language", "constant.character", "support.constant"],
        settings: { foreground: p.number },
      },
      {
        scope: [
          "entity.name.function",
          "support.function",
          "meta.function-call",
          "entity.name.command",
        ],
        settings: { foreground: p.fn },
      },
      {
        scope: ["constant.other.option", "variable.parameter", "constant.other.option.dash"],
        settings: { foreground: p.option },
      },
      {
        scope: [
          "support.type.property-name",
          "meta.object-literal.key",
          "entity.name.tag",
          "entity.other.attribute-name",
        ],
        settings: { foreground: p.property },
      },
      {
        scope: ["entity.name.type", "support.type", "support.class", "entity.name.class"],
        settings: { foreground: p.type },
      },
      { scope: ["variable", "variable.other"], settings: { foreground: p.variable } },
      {
        scope: ["markup.inserted", "punctuation.definition.inserted"],
        settings: { foreground: p.inserted },
      },
      {
        scope: ["markup.deleted", "punctuation.definition.deleted"],
        settings: { foreground: p.deleted },
      },
      {
        scope: ["markup.heading", "markup.bold"],
        settings: { foreground: p.fn, fontStyle: "bold" },
      },
    ],
  };
}

let highlighter: Promise<Highlighter> | undefined;

function getHighlighter(): Promise<Highlighter> {
  highlighter ??= createHighlighter({
    themes: [theme("shelf-dark", "dark", DARK), theme("shelf-light", "light", LIGHT)],
    langs: [...LANGS],
  });
  return highlighter;
}

let ready: Highlighter | undefined;

/** Loads the grammars once; call before rendering (rendering is synchronous). */
export async function prepare(): Promise<void> {
  ready = await getHighlighter();
}

const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function tokensHtml(code: string, lang: string): string[] {
  // Without prepare() (the docs test checks links without highlighting) code stays plain.
  if (!ready) return code.split("\n").map(escapeHtml);
  const { tokens } = ready.codeToTokens(code, {
    lang: lang as (typeof LANGS)[number],
    themes: { dark: "shelf-dark", light: "shelf-light" },
    defaultColor: false,
  });
  return tokens.map((line) =>
    line
      .map((token) => {
        const style = Object.entries(token.htmlStyle ?? {})
          .map(([key, value]) => `${key}:${value}`)
          .join(";");
        return style
          ? `<span style="${style}">${escapeHtml(token.content)}</span>`
          : escapeHtml(token.content);
      })
      .join(""),
  );
}

function resolveLang(lang: string): string | null {
  const name = ALIASES[lang] ?? lang;
  return (LANGS as readonly string[]).includes(name) ? name : null;
}

export interface CodeBlock {
  readonly html: string;
  /** The text the copy button copies (commands only, for shell sessions). */
  readonly copy: string;
}

/** A fenced code block as HTML: a figure with the highlighted <pre> and a copy button. */
export function highlightBlock(code: string, info: string | undefined): CodeBlock {
  const lang = (info ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const text = code.replace(/\n+$/, "");
  const lines = text.split("\n");
  const shellLike = resolveLang(lang) === "shellscript";
  const isConsole =
    CONSOLE_LANGS.has(lang) || (shellLike && lines.some((line) => /^\$ /.test(line)));

  if (isConsole) return consoleBlock(lines);

  const resolved = PLAIN_LANGS.has(lang) ? null : resolveLang(lang);
  const body = resolved ? tokensHtml(text, resolved) : lines.map((line) => escapeHtml(line));
  // Plain text (a usage line, a directory tree) gets no header bar.
  const label = resolved === "shellscript" ? "terminal" : PLAIN_LANGS.has(lang) ? "" : lang;
  return {
    html: figure(
      label,
      resolved === "shellscript" ? "shell" : "code",
      body.map((line) => `<span class="line">${line}</span>`).join("\n"),
    ),
    copy: text,
  };
}

function consoleBlock(lines: readonly string[]): CodeBlock {
  const commands: string[] = [];
  const indices: number[] = [];
  lines.forEach((line, index) => {
    if (/^\$ ?/.test(line) && line.startsWith("$")) {
      commands.push(line.replace(/^\$ ?/, ""));
      indices.push(index);
    }
  });
  const highlighted = commands.length > 0 ? tokensHtml(commands.join("\n"), "shellscript") : [];
  const html = lines
    .map((line, index) => {
      const at = indices.indexOf(index);
      if (at >= 0) {
        return `<span class="line cmd"><span class="prompt" aria-hidden="true">$ </span>${highlighted[at] ?? ""}</span>`;
      }
      return `<span class="line out">${escapeHtml(line)}</span>`;
    })
    .join("\n");
  const copy = commands.join("\n");
  return { html: figure("terminal", "shell console", html, copy), copy };
}

function figure(label: string, kind: string, inner: string, copy?: string): string {
  const data =
    copy === undefined ? "" : ` data-copy="${escapeHtml(copy).replaceAll('"', "&quot;")}"`;
  const head = label
    ? `<div class="code-head"><span class="code-lang">${escapeHtml(label)}</span></div>`
    : "";
  return `<figure class="code ${kind}${label ? " has-head" : ""}"${data}>${head}<pre tabindex="0"><code>${inner}</code></pre><button type="button" class="copy-code" aria-label="Copy code" title="Copy"><svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path d="M5 2.5h6.5a2 2 0 0 1 2 2V11M3.5 5h6a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg></button></figure>`;
}
