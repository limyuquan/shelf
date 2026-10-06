import { describe, expect, test } from "bun:test";
import {
  highlightParts,
  matchLocation,
  matchSearch,
  shortSnippet,
} from "../src/features/search/describe.ts";

const marked = (parts: { text: string; hit: boolean }[]) =>
  parts.map((part) => (part.hit ? `[${part.text}]` : part.text)).join("");

describe("highlightParts", () => {
  test("splits text into plain and hit parts", () => {
    expect(highlightParts("Use an error envelope.", [[7, 12]])).toEqual([
      { text: "Use an ", hit: false },
      { text: "error", hit: true },
      { text: " envelope.", hit: false },
    ]);
    expect(
      marked(
        highlightParts("retry then retry", [
          [0, 5],
          [11, 16],
        ]),
      ),
    ).toBe("[retry] then [retry]");
  });

  test("tolerates unsorted, overlapping, empty and out-of-range ranges", () => {
    expect(
      marked(
        highlightParts("abcdefghij", [
          [6, 8],
          [1, 4],
          [2, 5],
          [9, 9],
          [8, 50],
          [-3, 0],
        ]),
      ),
    ).toBe("a[bcd][e]f[gh][ij]");
    expect(highlightParts("plain", [])).toEqual([{ text: "plain", hit: false }]);
    expect(highlightParts("", [[0, 3]])).toEqual([]);
  });
});

describe("match location and link", () => {
  test("reference files show their name and line and open on that file", () => {
    const match = { file: "references/errors.md", line: 12 };
    expect(matchLocation(match)).toBe("errors.md:12");
    expect(matchSearch(match)).toEqual({ file: "references/errors.md" });
  });

  test("SKILL.md hits need no label and open the skill itself", () => {
    const match = { file: "SKILL.md", line: 3 };
    expect(matchLocation(match)).toBeNull();
    expect(matchSearch(match)).toEqual({});
  });
});

describe("shortSnippet", () => {
  test("keeps short snippets as they are", () => {
    expect(shortSnippet("Use an error envelope.", [[7, 12]])).toEqual({
      snippet: "Use an error envelope.",
      ranges: [[7, 12]],
    });
  });

  test("shortens around the first hit, keeping ranges aligned", () => {
    const text = `${"lead ".repeat(20)}needle${" tail".repeat(20)}`;
    const start = text.indexOf("needle");
    const result = shortSnippet(text, [[start, start + 6]], 40);
    expect(result.snippet.startsWith("…")).toBe(true);
    expect(result.snippet.endsWith("…")).toBe(true);
    expect(result.snippet.length).toBeLessThanOrEqual(42);
    const [[from, to] = [0, 0]] = result.ranges;
    expect(result.snippet.slice(from, to)).toBe("needle");
  });

  test("reuses an existing ellipsis instead of doubling it", () => {
    const text = `…${"word ".repeat(30)}hit`;
    const start = text.indexOf("hit");
    const result = shortSnippet(text, [[start, start + 3]], 30);
    expect(result.snippet).not.toContain("……");
    expect(result.snippet.endsWith("hit")).toBe(true);
    const [[from, to] = [0, 0]] = result.ranges;
    expect(result.snippet.slice(from, to)).toBe("hit");

    const head = shortSnippet(`hit ${"word ".repeat(30)}…`, [[0, 3]], 30);
    expect(head.snippet.startsWith("hit")).toBe(true);
    expect(head.snippet.endsWith("…")).toBe(true);
    expect(head.snippet).not.toContain("……");
  });

  test("drops hits that no longer fit", () => {
    const text = `first ${"x".repeat(100)} second`;
    const result = shortSnippet(
      text,
      [
        [0, 5],
        [text.length - 6, text.length],
      ],
      40,
    );
    expect(result.ranges).toEqual([[0, 5]]);
  });
});
