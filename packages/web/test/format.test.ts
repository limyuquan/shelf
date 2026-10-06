import { describe, expect, test } from "bun:test";
import {
  actorLabel,
  dueLabel,
  shortDate,
  shortHash,
  shortPath,
  sourceLabel,
  timeAgo,
} from "../src/lib/format.ts";

const NOW = new Date("2026-10-06T12:00:00Z").getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("format", () => {
  test.each([
    [ago(10_000), "just now"],
    [ago(5 * 60_000), "5m ago"],
    [ago(3 * 3_600_000), "3h ago"],
    [ago(86_400_000), "yesterday"],
    [ago(14 * 86_400_000), "2w ago"],
  ])("timeAgo(%s) is %p", (iso, expected) => {
    expect(timeAgo(iso, NOW)).toBe(expected);
  });

  test("due labels", () => {
    expect(dueLabel(5)).toBe("5 days left");
    expect(dueLabel(1)).toBe("1 day left");
    expect(dueLabel(0)).toBe("due today");
    expect(dueLabel(-1)).toBe("1 day overdue");
  });

  test("short forms", () => {
    expect(shortHash("sha256:9f86d081884c7d65")).toBe("9f86d081");
    expect(shortDate("2026-03-04T00:00:00Z", new Date(NOW))).toBe("Mar 4");
    expect(shortDate("2025-03-04T00:00:00Z", new Date(NOW))).toBe("Mar 4, 2025");
    expect(shortPath("/home/me/code/app", "/home/me")).toBe("~/code/app");
    expect(shortPath("/a/b/c/d/e/f/g")).toBe("/a/…/f/g");
    expect(sourceLabel("https://github.com/get-convex/agent-skills.git")).toBe(
      "github.com/get-convex/agent-skills",
    );
  });

  test("actors read as people and agents", () => {
    expect(actorLabel("agent:claude-code")).toBe("claude-code");
    expect(actorLabel("user")).toBe("you");
    expect(actorLabel("user:dashboard")).toBe("you (dashboard)");
  });
});
