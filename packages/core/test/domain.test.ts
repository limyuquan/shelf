import { describe, expect, test } from "bun:test";
import { addDays, parseDueExpression } from "../src/domain/due.ts";
import { contentState, dueState } from "../src/domain/loan-state.ts";
import { isValidSkillName } from "../src/domain/skill-name.ts";

describe("contentState", () => {
  const base = "sha256:base";
  const head = "sha256:head";
  const edited = "sha256:edited";

  test.each([
    { name: "current", head: base, working: [base, base], expected: "current" },
    { name: "behind", head, working: [base, base], expected: "behind" },
    { name: "modified", head: base, working: [base, edited], expected: "modified" },
    { name: "diverged", head, working: [edited, base], expected: "diverged" },
    { name: "missing", head: base, working: [base, null], expected: "missing" },
    { name: "all missing", head, working: [null, null], expected: "missing" },
    // Local edits must never be hidden behind `missing`, or a restore could overwrite them.
    { name: "edited + missing", head: base, working: [edited, null], expected: "modified" },
  ] as const)("$name", ({ head, working, expected }) => {
    expect(contentState({ base, head, working })).toBe(expected);
  });
});

describe("dueState", () => {
  const now = new Date("2026-10-06T12:00:00Z");

  test("active, due-soon and overdue", () => {
    expect(dueState(addDays(now, 30), now, 7)).toBe("active");
    expect(dueState(addDays(now, 7), now, 7)).toBe("due-soon");
    expect(dueState(addDays(now, 0.5), now, 7)).toBe("due-soon");
    expect(dueState(now, now, 7)).toBe("overdue");
    expect(dueState(addDays(now, -1), now, 7)).toBe("overdue");
  });
});

describe("parseDueExpression", () => {
  const due = new Date("2026-10-20T00:00:00Z");

  test("relative shifts", () => {
    expect(parseDueExpression("+14d", due)).toEqual(addDays(due, 14));
    expect(parseDueExpression("-7d", due)).toEqual(addDays(due, -7));
    expect(parseDueExpression("+2w", due)).toEqual(addDays(due, 14));
  });

  test("absolute date means end of that day (UTC)", () => {
    expect(parseDueExpression("2026-12-01", due).toISOString()).toBe("2026-12-01T23:59:59.999Z");
  });

  test.each(["14d", "+14", "tomorrow", "2026-13-45", ""])("rejects %p", (expression) => {
    expect(() => parseDueExpression(expression, due)).toThrow("Invalid due date");
  });
});

describe("isValidSkillName", () => {
  test.each(["pdf", "pdf-tools", "a1-b2-c3"])("accepts %p", (name) => {
    expect(isValidSkillName(name)).toBe(true);
  });
  test.each(["", "PDF", "-pdf", "pdf-", "pdf--tools", "pdf_tools", "a".repeat(65)])(
    "rejects %p",
    (name) => {
      expect(isValidSkillName(name)).toBe(false);
    },
  );
});
