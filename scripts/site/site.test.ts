import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkDocs, checkSchema } from "./check.ts";
import { loadDocs, ROOT, resolveLink, rewriteMarkdownLinks, SITE_URL, splitPage } from "./docs.ts";
import { FIXTURES_DIR } from "./gen.ts";
import { fillGenerated } from "./generate.ts";
import { createSlugger } from "./markdown.ts";

describe("docs", () => {
  // Fails when a generated block is stale (`bun run docs:gen`), a command has no
  // page, a page has no title or description, or a link or anchor is broken.
  test("docs/ is complete, fresh and has no broken links", () => {
    expect(checkDocs(join(ROOT, "docs"))).toEqual([]);
  });

  test("the site fixtures pass the same checks", () => {
    expect(checkDocs(FIXTURES_DIR)).toEqual([]);
  });

  test("schema/config.schema.json matches ConfigSchema", () => {
    expect(checkSchema()).toEqual([]);
  });

  test("the checks catch stale blocks, missing pages, descriptions and broken links", () => {
    const dir = mkdtempSync(join(tmpdir(), "shelf-docs-"));
    try {
      cpSync(FIXTURES_DIR, dir, { recursive: true });
      const nav = JSON.parse(readFileSync(join(dir, "nav.json"), "utf8")) as {
        group: string;
        pages: string[];
      }[];
      for (const group of nav) group.pages = group.pages.filter((page) => page !== "cli/renew");
      writeFileSync(join(dir, "nav.json"), JSON.stringify(nav));
      const borrow = join(dir, "cli/borrow.md");
      writeFileSync(
        borrow,
        readFileSync(borrow, "utf8")
          .replace("`--keep`", "`--kept`")
          .replace("(../introduction.md#how-loans-work)", "(../introduction.md#nowhere)")
          .replace("(adopt.md)", "(adoptt.md)"),
      );
      writeFileSync(join(dir, "configuration.md"), "# Configuration\n\n## Keys\n");

      const problems = checkDocs(dir);
      expect(problems).toContain(
        "cli/borrow.md: generated blocks are stale (run `bun run docs:gen`)",
      );
      expect(problems).toContain("nav.json: `shelf renew` has no page (expected cli/renew)");
      expect(problems).toContain("configuration.md: no description paragraph");
      expect(problems).toContain("cli/borrow.md: broken link to adoptt.md");
      expect(problems).toContain("cli/borrow.md: introduction.md has no heading for #nowhere");
      expect(problems).toContain("cli/index.md: configuration.md has no heading for #exit-codes");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("generated blocks", () => {
  test("fill replaces whatever is between the markers", () => {
    const stale = "# T\n\nD.\n\n<!-- generated:errors -->\nold\n<!-- /generated -->\n\nAfter.\n";
    const { markdown, blocks } = fillGenerated(stale, "errors");
    expect(blocks).toEqual(["errors"]);
    expect(markdown).toContain("| `NOT_BORROWED` | 4 |");
    expect(markdown).not.toContain("old");
    expect(markdown.endsWith("<!-- /generated -->\n\nAfter.\n")).toBe(true);
    expect(fillGenerated(markdown, "errors").markdown).toBe(markdown);
  });

  test("cli blocks document arguments, options and defaults from the command", () => {
    const { markdown } = fillGenerated(
      "<!-- generated:cli set save -->\n<!-- /generated -->",
      "cli/set",
    );
    expect(markdown).toContain("shelf set save <name> <skill>... [options]");
    expect(markdown).toContain("| `--description <description>`, `-d` | string |");
    expect(markdown).toContain("[CLI overview](index.md)");
  });

  test("unknown kinds, commands and unclosed markers are errors", () => {
    expect(() => fillGenerated("<!-- generated:nope -->\n<!-- /generated -->", "x")).toThrow(
      'unknown generated block "nope"',
    );
    expect(() => fillGenerated("<!-- generated:cli nope -->\n<!-- /generated -->", "x")).toThrow(
      'no command "shelf nope"',
    );
    expect(() => fillGenerated("<!-- generated:errors -->\n", "x")).toThrow("has no");
  });
});

describe("pages and links", () => {
  const docs = loadDocs(FIXTURES_DIR);

  test("a page is a title, a description paragraph and a body", () => {
    expect(splitPage("# Title\n\nOne\nparagraph.\n\n## Body\n")).toEqual({
      title: "Title",
      description: "One paragraph.",
      body: "## Body",
    });
    expect(splitPage("# Title\n\n## Straight to a heading\n").description).toBe("");
  });

  test("relative links resolve like GitHub: pages, docs assets, site media, repo files", () => {
    expect(resolveLink(docs, "cli/borrow", "../introduction.md#how-loans-work")).toEqual({
      kind: "page",
      path: "introduction",
      hash: "how-loans-work",
    });
    expect(resolveLink(docs, "cli/borrow", "index.md")).toMatchObject({
      kind: "page",
      path: "cli/index",
    });
    expect(resolveLink(docs, "introduction", "images/logo.png")).toMatchObject({
      kind: "asset",
      docsPath: "images/logo.png",
    });
    expect(resolveLink(docs, "introduction", "../assets/media/hero.mp4")).toMatchObject({
      kind: "site",
      siteRel: "media/hero.mp4",
    });
    expect(resolveLink(docs, "cli/borrow", "../../README.md")).toMatchObject({
      kind: "repo",
      repoPath: "README.md",
    });
    expect(resolveLink(docs, "cli/borrow", "nope.md")).toMatchObject({ kind: "missing" });
  });

  test("published Markdown links are absolute so agents can follow them", () => {
    const rewritten = rewriteMarkdownLinks(
      "See [loans](../introduction.md#how-loans-work) and `[not](a-link.md)`.\n\n```md\n[kept](x.md)\n```",
      (href) =>
        href.endsWith("introduction.md#how-loans-work")
          ? `${SITE_URL}/docs/introduction.md#how-loans-work`
          : href,
    );
    expect(rewritten).toContain(`[loans](${SITE_URL}/docs/introduction.md#how-loans-work)`);
    expect(rewritten).toContain("`[not](a-link.md)`");
    expect(rewritten).toContain("[kept](x.md)");
  });

  test("heading ids match GitHub's", () => {
    const slug = createSlugger();
    expect(slug("shelf set save")).toBe("shelf-set-save");
    expect(slug("--keep and `--off`")).toBe("--keep-and---off");
    expect(slug("What's new?")).toBe("whats-new");
    expect(slug("Usage")).toBe("usage");
    expect(slug("Usage")).toBe("usage-1");
  });
});
