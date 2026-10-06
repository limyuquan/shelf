import { describe, expect, test } from "bun:test";
import type { ContentState } from "../src/api/types.ts";
import {
  type BulkOutcome,
  keepable,
  keepKind,
  renewable,
  returnable,
  runPool,
  summarizeBulk,
  updatable,
} from "../src/features/loans/bulk.ts";

const loan = (skill: string, content: ContentState = "current", kept = false) => ({
  skill,
  content,
  kept,
});

const ok = (label: string): BulkOutcome => ({ key: label, label, error: null });
const failed = (label: string, message: string, hint: string | null = null): BulkOutcome => ({
  key: label,
  label,
  error: { message, hint },
});

describe("which selected loans an action applies to", () => {
  const loans = [
    loan("pdf"),
    loan("review", "behind"),
    loan("notes", "modified", true),
    loan("deploy", "diverged"),
  ];

  test("renew skips kept loans; update takes only loans behind", () => {
    expect(renewable(loans).map((l) => l.skill)).toEqual(["pdf", "review", "deploy"]);
    expect(updatable(loans).map((l) => l.skill)).toEqual(["review"]);
  });

  test("keep keeps the rest unless every loan is already kept", () => {
    expect(keepKind(loans)).toBe("keep");
    expect(keepable(loans, "keep").map((l) => l.skill)).toEqual(["pdf", "review", "deploy"]);
    const kept = [loan("a", "current", true), loan("b", "behind", true)];
    expect(keepKind(kept)).toBe("unkeep");
    expect(keepable(kept, "unkeep")).toHaveLength(2);
  });

  test("return leaves out loans with local edits unless the user deletes them", () => {
    expect(returnable(loans, false).map((l) => l.skill)).toEqual(["pdf", "review"]);
    expect(returnable(loans, true)).toHaveLength(4);
  });
});

describe("runPool", () => {
  test("runs at most `limit` at once and keeps the order of results", async () => {
    let running = 0;
    let peak = 0;
    const results = await runPool([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await Bun.sleep(n % 3);
      running--;
      if (n === 4) throw new Error("four");
      return n * 10;
    });
    expect(peak).toBe(3);
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : "x"))).toEqual([
      10,
      20,
      30,
      "x",
      50,
      60,
      70,
    ]);
    expect(await runPool([], 4, async () => 1)).toEqual([]);
  });
});

describe("summarizeBulk", () => {
  test("all succeeded", () => {
    expect(summarizeBulk("renew", [ok("pdf"), ok("review"), ok("notes")])).toEqual({
      tone: "success",
      title: "Renewed 3 skills",
      description: null,
    });
    expect(summarizeBulk("unkeep", [ok("pdf")]).title).toBe("Stopped keeping pdf");
  });

  test("some failed: counts both and lists the failures with the server's hint", () => {
    const summary = summarizeBulk("return", [
      ok("pdf"),
      ok("review"),
      ok("deploy"),
      failed("notes", 'The project copy of "notes" has local edits', "Discard them with --force"),
    ]);
    expect(summary).toEqual({
      tone: "warning",
      title: "Returned 3 skills · 1 failed",
      description: 'notes: The project copy of "notes" has local edits\nDiscard them with --force',
    });
  });

  test("all failed", () => {
    expect(summarizeBulk("update", [failed("pdf", "Nope", "Try again")])).toEqual({
      tone: "error",
      title: "Couldn't update pdf",
      description: "Nope\nTry again",
    });
    const many = summarizeBulk(
      "renew",
      ["a", "b", "c", "d", "e"].map((name) => failed(name, "Beyond the loan limit")),
    );
    expect(many.title).toBe("Couldn't renew 5 skills");
    expect(many.description).toBe(
      "a: Beyond the loan limit\nb: Beyond the loan limit\nc: Beyond the loan limit\nand 2 more",
    );
  });
});
