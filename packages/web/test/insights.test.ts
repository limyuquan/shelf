import { describe, expect, test } from "bun:test";
import type { Insights, ProjectInsight, SkillInsight } from "../src/api/types.ts";
import {
  budgetRows,
  dayLabel,
  formatTokens,
  median,
  niceCeil,
  scale,
  skillsUsedOn,
  sortSkills,
  summarize,
  usageBadge,
} from "../src/features/insights/describe.ts";

const skill = (name: string, overrides: Partial<SkillInsight> = {}): SkillInsight => ({
  name,
  descriptionTokens: 10,
  bodyTokens: 100,
  borrowers: 1,
  activeDays30: 0,
  lastUsedAt: null,
  neverUsed: true,
  daily: Array.from({ length: 30 }, () => 0),
  ...overrides,
});

const project = (name: string, globalTokens: number, sessionTokens: number): ProjectInsight => ({
  id: name,
  name,
  path: `/code/${name}`,
  skills: [],
  globalTokens,
  sessionTokens,
});

describe("insights helpers", () => {
  test("formats token counts compactly", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(940)).toBe("940");
    expect(formatTokens(1000)).toBe("1k");
    expect(formatTokens(1234)).toBe("1.2k");
    expect(formatTokens(12_600)).toBe("13k");
  });

  test("median, scale and clean axis maxima", () => {
    expect(median([])).toBe(0);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 2, 3])).toBe(3); // 2.5 rounds up
    expect(scale(5, 10)).toBe(50);
    expect(scale(5, 0)).toBe(0);
    expect(scale(20, 10)).toBe(100);
    expect([0, 1, 3, 7, 12, 40, 101].map(niceCeil)).toEqual([1, 1, 5, 10, 20, 50, 200]);
  });

  test("projects sort by session total, largest first", () => {
    const rows = budgetRows([project("a", 100, 50), project("b", 100, 400), project("c", 100, 50)]);
    expect(rows.map((row) => [row.project.name, row.total])).toEqual([
      ["b", 500],
      ["a", 150],
      ["c", 150],
    ]);
    expect(rows[0]).toMatchObject({ global: 100, borrowed: 400 });
  });

  test("sorts skills by each column, ties by name", () => {
    const skills = [
      skill("b", { activeDays30: 3, bodyTokens: 50, lastUsedAt: "2026-10-01T00:00:00Z" }),
      skill("a", { activeDays30: 3, bodyTokens: 900 }),
      skill("c", { activeDays30: 9, borrowers: 4, lastUsedAt: "2026-10-05T00:00:00Z" }),
    ];
    expect(sortSkills(skills, "active").map((s) => s.name)).toEqual(["c", "a", "b"]);
    expect(sortSkills(skills, "body").map((s) => s.name)).toEqual(["a", "c", "b"]);
    expect(sortSkills(skills, "lastUsed").map((s) => s.name)).toEqual(["c", "b", "a"]);
    expect(sortSkills(skills, "borrowers").map((s) => s.name)).toEqual(["c", "a", "b"]);
  });

  test("badges and summary", () => {
    const fresh = skill("fresh", { neverUsed: false, activeDays30: 2, borrowers: 2 });
    const stale = skill("stale", { neverUsed: false, lastUsedAt: "2026-08-01T00:00:00Z" });
    const idle = skill("idle", { borrowers: 0 });
    expect([fresh, stale, idle].map(usageBadge)).toEqual([null, "unused 30d", "never used"]);

    const insights: Insights = {
      globalSkills: [
        {
          name: "g",
          harnessDirs: [".claude/skills"],
          descriptionTokens: 30,
          bodyTokens: 0,
          bundled: false,
        },
      ],
      invalidGlobalSkills: 0,
      projects: [project("a", 30, 10), project("b", 30, 90), project("c", 30, 40)],
      skills: [fresh, stale, idle],
      usage: { days: [], active: [] },
    };
    expect(summarize(insights)).toEqual({
      skills: 3,
      activeLoans: 3,
      projects: 3,
      medianSession: 70,
      globalTokens: 30,
      unused: 2,
      neverUsed: 1,
    });
  });

  test("days are labelled in UTC and resolve to the skills used", () => {
    expect(dayLabel("2026-10-05")).toBe("Oct 5");
    const daily = Array.from({ length: 30 }, (_, index) => (index === 29 ? 2 : 0));
    expect(skillsUsedOn([skill("a", { daily }), skill("b")], 29)).toEqual(["a"]);
    expect(skillsUsedOn([skill("a", { daily })], 0)).toEqual([]);
  });
});
