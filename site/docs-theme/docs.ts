/**
 * The docs' only client script (bundled to docs/assets/docs.js by the site build):
 * theme toggle, search, copy buttons, the Copy page menu, the mobile sidebar and
 * the "On this page" scrollspy. No framework; everything works without it except
 * search and copying.
 */

const html = document.documentElement;
const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) =>
  root.querySelector<T>(selector);
const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => [
  ...root.querySelectorAll<T>(selector),
];
const docsUrl = (path: string) =>
  new URL(path, new URL(html.dataset.docsRoot ?? "./", document.baseURI)).href;
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

// ---------------------------------------------------------------------------
// Theme: follows the system until toggled, then remembers the choice.

const THEME_KEY = "shelf-theme";

function applyTheme(theme: "light" | "dark"): void {
  html.dataset.theme = theme;
  for (const button of $$("[data-theme-toggle]")) {
    button.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} theme`);
  }
}

function initTheme(): void {
  applyTheme(html.dataset.theme === "light" ? "light" : "dark");
  for (const button of $$("[data-theme-toggle]")) {
    button.addEventListener("click", () => {
      const next = html.dataset.theme === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {}
      applyTheme(next);
    });
  }
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", (event) => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch {}
    if (!saved) applyTheme(event.matches ? "light" : "dark");
  });
}

// ---------------------------------------------------------------------------
// Clipboard

async function copyText(text: string | Promise<string>): Promise<void> {
  // Safari drops the user gesture across an await, so hand it a promise.
  if (typeof text !== "string" && "ClipboardItem" in window && navigator.clipboard?.write) {
    const blob = text.then((value) => new Blob([value], { type: "text/plain" }));
    await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
    return;
  }
  const value = await text;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

function flash(button: HTMLElement, label = "Copied"): void {
  button.dataset.copied = "true";
  const text = $("span", button);
  const before = text?.textContent ?? null;
  if (text && before && before !== label) text.textContent = label;
  const announce = $("#live-region");
  if (announce) announce.textContent = label;
  window.setTimeout(() => {
    delete button.dataset.copied;
    if (text && before) text.textContent = before;
  }, 1600);
}

function initCodeCopy(): void {
  for (const button of $$(".copy-code")) {
    button.addEventListener("click", () => {
      const figure = button.closest<HTMLElement>("figure");
      if (!figure) return;
      const text = figure.dataset.copy ?? $("code", figure)?.textContent ?? "";
      void copyText(text).then(() => flash(button));
    });
  }
  for (const button of $$("[data-copy-text]")) {
    button.addEventListener("click", () => {
      void copyText(button.dataset.copyText ?? "").then(() => flash(button));
    });
  }
}

// ---------------------------------------------------------------------------
// Copy page: copies the page's Markdown; the menu has the other options.

function initCopyPage(): void {
  const root = $(".copy-page");
  if (!root) return;
  const markdownUrl = new URL(root.dataset.markdown ?? "", location.href).href;
  let cached: Promise<string> | null = null;
  const markdown = () => {
    cached ??= fetch(markdownUrl).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    });
    return cached;
  };
  const toggle = $<HTMLButtonElement>("[data-copy-menu-toggle]", root);
  const menu = $(".copy-menu", root);
  const main = $<HTMLButtonElement>(".copy-page-main", root);

  const close = (focus = false) => {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    toggle?.setAttribute("aria-expanded", "false");
    if (focus) toggle?.focus();
  };
  const open = () => {
    if (!menu) return;
    menu.hidden = false;
    toggle?.setAttribute("aria-expanded", "true");
    $<HTMLElement>("[role=menuitem]", menu)?.focus();
  };

  root.addEventListener("pointerenter", () => void markdown().catch(() => {}), { once: true });
  for (const button of $$("[data-copy-page]", root)) {
    button.addEventListener("click", () => {
      void copyText(markdown())
        .then(() => flash(main ?? button, "Copied"))
        .catch(() => flash(main ?? button, "Copy failed"));
      close();
    });
  }
  toggle?.addEventListener("click", () => (menu?.hidden ? open() : close()));
  menu?.addEventListener("keydown", (event) => {
    const items = $$<HTMLElement>("[role=menuitem]", menu);
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(at + step + items.length) % items.length]?.focus();
    } else if (event.key === "Escape") {
      close(true);
    } else if (event.key === "Tab") {
      close();
    }
  });
  for (const item of $$("a[role=menuitem]", menu ?? root)) {
    item.addEventListener("click", () => close());
  }
  document.addEventListener("click", (event) => {
    if (!root.contains(event.target as Node)) close();
  });
}

// ---------------------------------------------------------------------------
// Sidebar drawer (narrow screens)

function initSidebar(): void {
  const sidebar = $("#sidebar");
  const scrim = $(".scrim");
  const openers = $$("[data-open-sidebar]");
  if (!sidebar) return;
  const setOpen = (open: boolean) => {
    sidebar.dataset.open = String(open);
    html.classList.toggle("sidebar-open", open);
    if (scrim) scrim.hidden = !open;
    for (const button of openers) button.setAttribute("aria-expanded", String(open));
    if (open) $<HTMLElement>("[aria-current=page], a", sidebar)?.focus();
    else if (document.activeElement && sidebar.contains(document.activeElement))
      openers[0]?.focus();
  };
  for (const button of openers) button.addEventListener("click", () => setOpen(true));
  for (const button of $$("[data-close-sidebar]")) {
    button.addEventListener("click", () => setOpen(false));
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sidebar.dataset.open === "true") setOpen(false);
  });
  matchMedia("(min-width: 1024px)").addEventListener("change", (event) => {
    if (event.matches) setOpen(false);
  });
  // Keep the current page in view in a long sidebar.
  const current = $<HTMLElement>("[aria-current=page]", sidebar);
  const nav = $<HTMLElement>(".sidebar-nav", sidebar);
  if (current && nav) {
    const top = current.offsetTop - nav.offsetTop;
    if (top > sidebar.clientHeight * 0.6) sidebar.scrollTop = top - sidebar.clientHeight / 3;
  }
}

// ---------------------------------------------------------------------------
// "On this page" scrollspy

function initScrollspy(): void {
  const links = $$<HTMLAnchorElement>("[data-toc-link]");
  if (links.length === 0) return;
  const ids = [...new Set(links.map((link) => link.dataset.tocLink ?? ""))];
  const headings = ids
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => el !== null);
  let ticking = false;
  const update = () => {
    ticking = false;
    const offset = 120;
    let active = headings[0]?.id ?? "";
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top - offset <= 0) active = heading.id;
      else break;
    }
    // At the very bottom, the last heading may never reach the top.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      active = headings[headings.length - 1]?.id ?? active;
    }
    for (const link of links) {
      const on = link.dataset.tocLink === active;
      link.classList.toggle("active", on);
      if (on) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
  };
  addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
  // Close the mobile "On this page" after choosing a section.
  for (const link of $$(".toc-mobile a")) {
    link.addEventListener("click", () => {
      link.closest("details")?.removeAttribute("open");
    });
  }
  $("[data-back-to-top]")?.addEventListener("click", (event) => {
    event.preventDefault();
    scrollTo({ top: 0, behavior: "smooth" });
    history.replaceState(null, "", location.pathname + location.search);
  });
}

// ---------------------------------------------------------------------------
// Search over docs/search.json (built from every page section).

interface Entry {
  readonly t: string;
  readonly g: string;
  readonly u: string;
  readonly h: string;
  readonly x: string;
  readonly k: string;
}

interface Indexed extends Entry {
  readonly title: string;
  readonly heading: string;
  readonly keys: readonly string[];
  readonly text: string;
}

let index: Promise<Indexed[]> | null = null;

function loadIndex(): Promise<Indexed[]> {
  index ??= fetch(docsUrl("search.json"))
    .then((response) => response.json() as Promise<Entry[]>)
    .then((entries) =>
      entries.map((entry) => ({
        ...entry,
        title: entry.t.toLowerCase(),
        heading: entry.h.toLowerCase(),
        keys: entry.k.toLowerCase().split(" ").filter(Boolean),
        text: entry.x.toLowerCase(),
      })),
    );
  return index;
}

/** Every term must match somewhere; titles, headings and code (commands, flags) weigh most. */
function score(entry: Indexed, terms: readonly string[]): number {
  let total = 0;
  for (const term of terms) {
    const titleWords = entry.title.split(/[\s/]+/);
    let best = 0;
    if (titleWords.includes(term)) best = Math.max(best, entry.heading ? 40 : 60);
    else if (entry.title.includes(term)) best = Math.max(best, entry.heading ? 14 : 24);
    if (entry.heading) {
      const headingWords = entry.heading.split(/[\s/]+/);
      if (headingWords.includes(term)) best = Math.max(best, 36);
      else if (entry.heading.includes(term)) best = Math.max(best, 18);
    }
    if (entry.keys.includes(term)) best = Math.max(best, 22);
    else if (entry.keys.some((key) => key.startsWith(term))) best = Math.max(best, 12);
    if (best === 0 && entry.text.includes(term)) best = 3;
    if (best === 0) return 0;
    total += best;
  }
  return total + (entry.heading ? 0 : 2);
}

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );

function highlight(text: string, terms: readonly string[]): string {
  if (terms.length === 0) return escapeHtml(text);
  const pattern = new RegExp(
    `(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );
  return text
    .split(pattern)
    .map((part, i) => (i % 2 === 1 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)))
    .join("");
}

/** A window of the section text around the first match. */
function snippet(text: string, terms: readonly string[]): string {
  const lower = text.toLowerCase();
  const at = Math.min(
    ...terms.map((term) => {
      const i = lower.indexOf(term);
      return i < 0 ? Number.POSITIVE_INFINITY : i;
    }),
  );
  if (!Number.isFinite(at) || at < 60) return text.slice(0, 140);
  const start = text.lastIndexOf(" ", at - 40) + 1;
  return `…${text.slice(start, start + 140)}`;
}

function initSearch(): void {
  const dialog = $<HTMLDialogElement>(".search-dialog");
  const input = $<HTMLInputElement>(".search-input");
  const list = $<HTMLUListElement>(".search-results");
  if (!dialog || !input || !list) return;
  for (const key of $$("[data-mod-key]")) key.textContent = isMac ? "⌘" : "Ctrl";

  let results: Indexed[] = [];
  let selected = 0;

  const render = (terms: readonly string[]) => {
    if (input.value.trim() === "") {
      list.innerHTML = `<li class="search-empty">Type a page, a command such as <code>borrow</code>, or a flag such as <code>--keep</code>.</li>`;
      input.removeAttribute("aria-activedescendant");
      return;
    }
    if (results.length === 0) {
      list.innerHTML = `<li class="search-empty">No results for “${escapeHtml(input.value.trim())}”.</li>`;
      input.removeAttribute("aria-activedescendant");
      return;
    }
    list.innerHTML = results
      .map((entry, i) => {
        const where = entry.h
          ? `<span class="result-page">${escapeHtml(entry.t)}</span><span class="result-sep" aria-hidden="true">›</span><span class="result-heading">${highlight(entry.h, terms)}</span>`
          : `<span class="result-heading">${highlight(entry.t, terms)}</span>`;
        return `<li role="option" id="result-${i}" aria-selected="${i === selected}">
          <a href="${escapeHtml(docsUrl(entry.u))}" tabindex="-1">
            <span class="result-top">${where}${entry.g ? `<span class="result-group">${escapeHtml(entry.g)}</span>` : ""}</span>
            <span class="result-text">${highlight(snippet(entry.x, terms), terms)}</span>
          </a>
        </li>`;
      })
      .join("");
    input.setAttribute("aria-activedescendant", `result-${selected}`);
  };

  const run = async () => {
    const query = input.value.trim().toLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    const entries = await loadIndex();
    if (query !== input.value.trim().toLowerCase()) return;
    results = entries
      .map((entry) => ({ entry, score: score(entry, terms) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((r) => r.entry);
    selected = 0;
    render(terms);
  };

  const move = (step: number) => {
    if (results.length === 0) return;
    selected = (selected + step + results.length) % results.length;
    for (const [i, item] of $$("[role=option]", list).entries()) {
      item.setAttribute("aria-selected", String(i === selected));
      if (i === selected) item.scrollIntoView({ block: "nearest" });
    }
    input.setAttribute("aria-activedescendant", `result-${selected}`);
  };

  const open = () => {
    if (dialog.open) return;
    void loadIndex();
    dialog.showModal();
    html.classList.add("search-open");
    input.select();
    void run();
  };
  const close = () => dialog.close();
  dialog.addEventListener("close", () => html.classList.remove("search-open"));

  for (const button of $$("[data-open-search]")) button.addEventListener("click", open);
  $("[data-close-search]")?.addEventListener("click", close);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  input.addEventListener("input", () => void run());
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Enter") {
      const link = $<HTMLAnchorElement>(`#result-${selected} a`, list);
      if (link) {
        event.preventDefault();
        go(link.href);
      }
    }
  });
  list.addEventListener("click", (event) => {
    const link = (event.target as Element).closest("a");
    if (link) {
      event.preventDefault();
      go(link.href);
    }
  });
  const go = (href: string) => {
    close();
    const url = new URL(href);
    if (url.pathname === location.pathname && url.hash) {
      location.hash = url.hash;
    } else {
      location.href = href;
    }
  };

  document.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement;
    const typing = target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      dialog.open ? close() : open();
    } else if (event.key === "/" && !typing && !dialog.open) {
      event.preventDefault();
      open();
    }
  });
}

// ---------------------------------------------------------------------------

function init(): void {
  const live = document.createElement("div");
  live.id = "live-region";
  live.className = "sr-only";
  live.setAttribute("aria-live", "polite");
  document.body.append(live);
  initTheme();
  initCodeCopy();
  initCopyPage();
  initSidebar();
  initScrollspy();
  initSearch();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
