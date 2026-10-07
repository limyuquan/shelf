import { describe, expect, test } from "bun:test";
import type { AttentionItem } from "../src/api/types.ts";
import { describeAttention } from "../src/features/attention/describe.ts";

const NOW = new Date("2026-10-06T12:00:00Z").getTime();

function item(overrides: Partial<AttentionItem>): AttentionItem {
  return {
    skill: "pdf",
    content: "current",
    due: "due-soon",
    dueAt: "2026-10-10T12:00:00.000Z",
    daysLeft: 4,
    lastUsedAt: null,
    kept: false,
    loanDays: 30,
    policy: "pinned",
    revision: "sha256:a",
    latestRevision: "sha256:a",
    targets: [".agents/skills"],
    project: { id: "p", name: "app", path: "/code/app" },
    reasons: ["due-soon"],
    ...overrides,
  };
}

describe("attention descriptions", () => {
  test("due soon says how long the skill has gone unused", () => {
    expect(describeAttention(item({}), NOW)).toBe(
      "Never used since borrowed · returned in 4 days unless used",
    );
    expect(describeAttention(item({ lastUsedAt: "2026-09-12T12:00:00.000Z" }), NOW)).toStartWith(
      "Unused for 24 days",
    );
  });

  test("the most urgent reason wins", () => {
    expect(
      describeAttention(
        item({ reasons: ["overdue", "modified"], content: "modified", daysLeft: -3 }),
        NOW,
      ),
    ).toBe("Overdue by 3 days, not returned because it has local edits");
  });

  test("an overdue loan without edits is only waiting for the next sync", () => {
    for (const content of ["current", "behind", "missing"] as const) {
      expect(describeAttention(item({ reasons: ["overdue"], content, daysLeft: -1 }), NOW)).toBe(
        "Overdue by 1 day, returned the next time shelf syncs the project",
      );
    }
    expect(
      describeAttention(
        item({ reasons: ["overdue", "diverged"], content: "diverged", daysLeft: -2 }),
        NOW,
      ),
    ).toBe("Overdue by 2 days, not returned because it has local edits");
  });
});
