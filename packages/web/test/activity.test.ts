import { describe, expect, test } from "bun:test";
import type { ActivityEvent } from "../src/api/types.ts";
import { dayLabel, describeGroup, groupEvents } from "../src/features/activity/describe.ts";

let id = 0;
function event(overrides: Partial<ActivityEvent>): ActivityEvent {
  id += 1;
  return {
    id,
    at: "2026-10-06T12:00:00.000Z",
    actor: "agent:claude-code",
    type: "loan.adopted",
    projectId: "p1",
    project: "app",
    skill: "pdf",
    detail: null,
    ...overrides,
  };
}

describe("activity grouping", () => {
  test("a burst of the same action becomes one entry", () => {
    const groups = groupEvents([
      event({ skill: "a", at: "2026-10-06T12:00:30.000Z" }),
      event({ skill: "b", at: "2026-10-06T12:00:20.000Z" }),
      event({ skill: "c", at: "2026-10-06T12:00:10.000Z" }),
      event({ type: "project.registered", skill: null, at: "2026-10-06T12:00:00.000Z" }),
    ]);
    expect(groups.map((group) => [group.type, group.skills])).toEqual([
      ["loan.adopted", ["a", "b", "c"]],
      ["project.registered", []],
    ]);
  });

  test("different projects, actors or a gap split groups", () => {
    const groups = groupEvents([
      event({ skill: "a" }),
      event({ skill: "b", projectId: "p2", project: "api" }),
      event({ skill: "c", projectId: "p2", project: "api", actor: "agent:codex" }),
      event({
        skill: "d",
        projectId: "p2",
        project: "api",
        actor: "agent:codex",
        at: "2026-10-06T11:00:00.000Z",
      }),
    ]);
    expect(groups).toHaveLength(4);
  });

  test("renewals carry the agent's reason", () => {
    const [group] = groupEvents([
      event({ type: "loan.due-changed", detail: { reason: "still writing tests" } }),
    ]);
    expect(describeGroup(group as never)).toMatchObject({
      actor: "claude-code",
      verb: "renewed",
      detail: "still writing tests",
    });
  });

  test("a restored revision reads as a restore", () => {
    const [group] = groupEvents([
      event({
        type: "skill.revised",
        projectId: null,
        project: null,
        detail: { revision: "sha256:9f86d081abc", restoredFrom: "sha256:9f86d081abc" },
      }),
    ]);
    expect(describeGroup(group as never)).toMatchObject({
      verb: "restored",
      detail: "to rev 9f86d081",
    });
  });

  test("keeping a loan, on and off", () => {
    const kept = (detail: ActivityEvent["detail"]) =>
      describeGroup(groupEvents([event({ type: "loan.kept", actor: "user", detail })])[0] as never);
    expect(kept({ keep: true })).toMatchObject({
      actor: "you",
      verb: "kept",
      preposition: "in",
      detail: "never expires",
    });
    expect(kept({ keep: false })).toMatchObject({ verb: "stopped keeping", detail: null });
    expect(kept({ keep: true, source: "lockfile" })).toMatchObject({
      verb: "kept",
      detail: "from the lockfile",
    });
    // Stopping right after keeping reads as two entries, not one.
    const toggled = groupEvents([
      event({ type: "loan.kept", skill: "a", detail: { keep: false } }),
      event({ type: "loan.kept", skill: "b", detail: { keep: true } }),
    ]);
    expect(toggled.map((group) => describeGroup(group).verb)).toEqual(["stopped keeping", "kept"]);
    const [borrowed] = groupEvents([event({ type: "loan.borrowed", detail: { keep: true } })]);
    expect(describeGroup(borrowed as never).detail).toBe("kept, never expires");
  });

  test("day headings", () => {
    const now = new Date("2026-10-06T15:00:00");
    expect(dayLabel(new Date("2026-10-06T09:00:00").toISOString(), now)).toBe("Today");
    expect(dayLabel(new Date("2026-10-05T23:00:00").toISOString(), now)).toBe("Yesterday");
    expect(dayLabel(new Date("2026-10-02T10:00:00").toISOString(), now)).toBe("Friday, Oct 2");
    expect(dayLabel(new Date("2026-08-02T10:00:00").toISOString(), now)).toBe("Aug 2");
  });
});
