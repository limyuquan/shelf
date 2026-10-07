/**
 * Checks a docs directory the way the docs test does, without building:
 * stale generated blocks, commands without a page, pages without a title or
 * description, and broken links or anchors between pages.
 *
 * Usage: bun scripts/site/check.ts [docs-dir]   (default: docs/)
 */
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { type Docs, loadDocs, ROOT } from "./docs.ts";
import { SCHEMA_FILE } from "./gen.ts";
import { configJsonSchema, topLevelCommands } from "./generate.ts";
import { renderMarkdown } from "./markdown.ts";

/** Every problem found, as "<file>: <what>" lines; empty when the docs are good. */
export function checkDocs(dir: string): string[] {
  const problems: string[] = [];
  let docs: Docs;
  try {
    docs = loadDocs(dir);
  } catch (error) {
    // An unknown generated block or command, or an unterminated marker.
    return [error instanceof Error ? error.message : String(error)];
  }
  problems.push(...docs.warnings);
  const file = (path: string) => `${path}.md`;

  for (const page of docs.pages.values()) {
    if (page.source !== page.markdown) {
      problems.push(`${file(page.path)}: generated blocks are stale (run \`bun run docs:gen\`)`);
    }
  }

  const listed = new Set(docs.nav.flatMap((group) => group.pages));
  for (const { name } of topLevelCommands()) {
    if (!listed.has(`cli/${name}`)) {
      problems.push(`nav.json: \`shelf ${name}\` has no page (expected cli/${name})`);
    }
  }
  for (const page of docs.ordered) {
    if (!page.description) problems.push(`${file(page.path)}: no description paragraph`);
  }

  // Links and anchors: render every page (without highlighting) to collect them.
  const ids = new Map<string, Set<string>>();
  const rendered = [...docs.pages.values()].map((page) => {
    const body = renderMarkdown(docs, page.path, page.body);
    const lede = renderMarkdown(docs, page.path, page.description);
    ids.set(page.path, new Set(body.ids));
    return { page, links: [...lede.links, ...body.links] };
  });
  for (const { page, links } of rendered) {
    for (const link of links) {
      if (link.kind === "missing") {
        problems.push(`${file(page.path)}: broken link to ${link.target}`);
      } else if (link.kind === "anchor" && !ids.get(page.path)?.has(link.hash)) {
        problems.push(`${file(page.path)}: no heading for #${link.hash}`);
      } else if (link.kind === "page" && link.hash && !ids.get(link.path)?.has(link.hash)) {
        problems.push(`${file(page.path)}: ${file(link.path)} has no heading for #${link.hash}`);
      }
    }
  }
  return problems;
}

/** schema/config.schema.json must match ConfigSchema. */
export function checkSchema(): string[] {
  const current = existsSync(SCHEMA_FILE) ? readFileSync(SCHEMA_FILE, "utf8") : null;
  return current === configJsonSchema()
    ? []
    : [`${relative(ROOT, SCHEMA_FILE)} is stale (run \`bun run docs:gen\`)`];
}

if (import.meta.main) {
  const dir = resolve(process.argv[2] ?? join(ROOT, "docs"));
  const problems = [...checkDocs(dir), ...checkSchema()];
  for (const problem of problems) console.log(problem);
  console.log(
    problems.length === 0
      ? `${relative(process.cwd(), dir) || "."}: no problems`
      : `${problems.length} problem(s)`,
  );
  process.exitCode = problems.length === 0 ? 0 : 1;
}
