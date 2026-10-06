import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  hitRanges,
  parseQuery,
  SNIPPET_LENGTH,
  searchLibrary,
  snippet,
} from "../src/services/search.ts";
import { createTestEnv } from "./helpers.ts";

/** A library of hand-written skills: `{ name: { description, body, files } }`. */
async function library(
  skills: Record<
    string,
    { description?: string; body?: string; files?: Record<string, string | Uint8Array> }
  >,
) {
  const env = await createTestEnv();
  for (const [name, skill] of Object.entries(skills)) {
    const dir = join(env.shelfHome, "library", name);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "SKILL.md"),
      `---\nname: ${name}\ndescription: ${skill.description ?? `The ${name} skill`}\n---\n${skill.body ?? ""}\n`,
    );
    for (const [path, content] of Object.entries(skill.files ?? {})) {
      await mkdir(join(dir, path, ".."), { recursive: true });
      await writeFile(join(dir, path), content);
    }
  }
  return env.context();
}

const names = (results: { name: string }[]) => results.map((result) => result.name);

describe("parseQuery", () => {
  test("splits on whitespace, keeps quoted phrases, lowercases and dedupes", () => {
    expect(parseQuery('  Retry "Error   Envelope" retry  "unclosed phrase')).toEqual([
      "retry",
      "error envelope",
      "unclosed phrase",
    ]);
    expect(parseQuery('  "" ')).toEqual([]);
  });
});

describe("searchLibrary", () => {
  test("matches the SKILL.md body case-insensitively and reports the line", async () => {
    const ctx = await library({
      api: { body: "# API\n\nReturn an Error Envelope on failure." },
      pdf: { body: "# PDF" },
    });
    const [result, ...rest] = await searchLibrary(ctx, "envelope");
    expect(rest).toEqual([]);
    expect(result).toMatchObject({
      name: "api",
      description: "The api skill",
      matches: [{ file: "SKILL.md", line: 7, snippet: "Return an Error Envelope on failure." }],
    });
    const [match] = result?.matches ?? [];
    const [start, end] = match?.ranges[0] ?? [0, 0];
    expect(match?.snippet.slice(start, end)).toBe("Envelope");
  });

  test("every term must match somewhere in the skill, across fields and files", async () => {
    const ctx = await library({
      api: { description: "HTTP API design", files: { "references/errors.md": "Use retries." } },
      http: { description: "HTTP clients" },
    });
    expect(names(await searchLibrary(ctx, "http retries"))).toEqual(["api"]);
    expect(names(await searchLibrary(ctx, "http"))).toEqual(["http", "api"]);
    expect(await searchLibrary(ctx, "http nothing-like-this")).toEqual([]);
    expect(await searchLibrary(ctx, "   ")).toEqual([]);
  });

  test("a quoted phrase matches only as a phrase", async () => {
    const ctx = await library({
      together: { body: "Wrap failures in an error envelope." },
      apart: { body: "An envelope holds each error." },
    });
    expect(names(await searchLibrary(ctx, '"error envelope"'))).toEqual(["together"]);
    expect(names(await searchLibrary(ctx, "error envelope"))).toEqual(["apart", "together"]);
  });

  test("searches text reference files and skips binary ones", async () => {
    const ctx = await library({
      api: {
        files: {
          "references/pagination.md": "# Pagination\n\nUse cursor tokens, never offsets.\n",
          "assets/logo.png": new Uint8Array([137, 80, 0, 1, ...new TextEncoder().encode("cursor")]),
        },
      },
    });
    const [result] = await searchLibrary(ctx, "cursor");
    expect(result?.matches).toEqual([
      {
        file: "references/pagination.md",
        line: 3,
        snippet: "Use cursor tokens, never offsets.",
        ranges: [[4, 10]],
      },
    ]);
  });

  test("skips oversized files like the file viewer does", async () => {
    const ctx = await library({
      big: { files: { "data.txt": `${"x".repeat(1024 * 1024)} needle` } },
    });
    expect(await searchLibrary(ctx, "needle")).toEqual([]);
  });

  test("ranks name over description over body over reference files, then by name", async () => {
    const ctx = await library({
      "z-reference": { files: { "notes.md": "migrations" } },
      "y-body": { body: "migrations" },
      "x-description": { description: "Database migrations" },
      migrations: {},
      "b-body": { body: "migrations" },
    });
    expect(names(await searchLibrary(ctx, "migrations"))).toEqual([
      "migrations",
      "x-description",
      "b-body",
      "y-body",
      "z-reference",
    ]);
  });

  test("more occurrences rank higher within a field, and limit caps the results", async () => {
    const ctx = await library({
      once: { body: "Use a lock." },
      thrice: { body: "Take the lock.\nHold the lock.\nRelease the lock." },
    });
    const results = await searchLibrary(ctx, "lock");
    expect(names(results)).toEqual(["thrice", "once"]);
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
    expect(names(await searchLibrary(ctx, "lock", { limit: 1 }))).toEqual(["thrice"]);
  });

  test("returns up to three matches, lines with more terms first", async () => {
    const ctx = await library({
      api: {
        body: "retry here\nretry again\nbackoff only\nretry with backoff\nretry once more",
        files: { "references/r.md": "retry and backoff" },
      },
    });
    const [result] = await searchLibrary(ctx, "retry backoff");
    expect(result?.matches.map((match) => `${match.file}:${match.line}`)).toEqual([
      "SKILL.md:8",
      "references/r.md:1",
      "SKILL.md:5",
    ]);
  });

  test("a body line repeating the description is not a snippet", async () => {
    const ctx = await library({
      api: { description: "Design APIs", body: "# API\n\nDesign APIs\n\nDesign errors first." },
    });
    const [result] = await searchLibrary(ctx, "design");
    expect(result?.matches.map((match) => match.snippet)).toEqual(["Design errors first."]);
  });

  test("does not match the frontmatter as body text", async () => {
    const ctx = await library({ api: { description: "Design APIs" } });
    const [result] = await searchLibrary(ctx, "design");
    expect(result?.matches).toEqual([]);
  });
});

describe("snippet", () => {
  test("keeps short lines whole, without their indentation", () => {
    const line = "    - Use an error envelope";
    expect(snippet(line, hitRanges(line, ["envelope"]))).toEqual({
      snippet: "- Use an error envelope",
      ranges: [[15, 23]],
    });
  });

  test("centres long lines on the hit, within bounds, with ellipses", () => {
    const words = Array.from({ length: 80 }, (_, i) => `word${i}`);
    words[40] = "NEEDLE";
    const line = words.join(" ");
    const result = snippet(line, hitRanges(line, ["needle"]));
    expect(result.snippet.startsWith("…")).toBe(true);
    expect(result.snippet.endsWith("…")).toBe(true);
    expect(result.snippet.length).toBeLessThanOrEqual(SNIPPET_LENGTH + 2);
    expect(result.snippet.length).toBeGreaterThan(SNIPPET_LENGTH - 30);
    const [[start, end] = [0, 0]] = result.ranges;
    expect(result.snippet.slice(start, end)).toBe("NEEDLE");
    const centre = (start + end) / 2;
    expect(Math.abs(centre - result.snippet.length / 2)).toBeLessThan(20);
    // Cut at word boundaries.
    expect(result.snippet).toMatch(/^…word\d+ /);
    expect(result.snippet).toMatch(/ word\d+…$/);
  });

  test("a hit at the start or end of a long line gets one ellipsis", () => {
    const line = `needle ${"filler ".repeat(40)}`.trim();
    const head = snippet(line, hitRanges(line, ["needle"]));
    expect(head.snippet.startsWith("needle")).toBe(true);
    expect(head.ranges).toEqual([[0, 6]]);
    expect(head.snippet.endsWith("…")).toBe(true);

    const tail = `${"filler ".repeat(40)}needle`;
    const end = snippet(tail, hitRanges(tail, ["needle"]));
    expect(end.snippet.startsWith("…")).toBe(true);
    expect(end.snippet.endsWith("needle")).toBe(true);
    const [[start, stop] = [0, 0]] = end.ranges;
    expect(end.snippet.slice(start, stop)).toBe("needle");
  });

  test("drops hits that fall outside the window", () => {
    const line = `alpha ${"x".repeat(300)} alpha`;
    const result = snippet(line, hitRanges(line, ["alpha"]));
    expect(result.ranges).toEqual([[0, 5]]);
  });

  test("hitRanges merges overlapping terms", () => {
    expect(hitRanges("error envelope", ["error", "error envelope", "env"])).toEqual([[0, 14]]);
  });
});
