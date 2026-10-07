import { describe, expect, test } from "bun:test";
import { detectActor } from "../src/actor.ts";

describe("detectActor", () => {
  test.each([
    [{ CODEX_THREAD_ID: "t1" }, "agent:codex"],
    [{ CODEX_SESSION_ID: "s1" }, "agent:codex"],
    [{ CLAUDECODE: "1" }, "agent:claude-code"],
    // Codex launched from a Claude Code session inherits CLAUDECODE; Codex is running us.
    [
      { CLAUDECODE: "1", AI_AGENT: "claude-code_2-1-289_agent", CODEX_THREAD_ID: "t1" },
      "agent:codex",
    ],
    [{ AI_AGENT: "cursor_1-2_agent" }, "agent:cursor"],
    [{ AI_AGENT: "claude-code_2-1-289_agent" }, "agent:claude-code"],
  ])("%o → %s", (env, actor) => {
    expect(detectActor(undefined, env, false)).toBe(actor);
  });

  test("explicit and SHELF_ACTOR win; otherwise a terminal user or unknown", () => {
    expect(detectActor("me", { CLAUDECODE: "1" }, false)).toBe("me");
    expect(detectActor(undefined, { SHELF_ACTOR: "ci", CODEX_THREAD_ID: "t" }, false)).toBe("ci");
    expect(detectActor(undefined, {}, true)).toBe("user");
    expect(detectActor(undefined, {}, false)).toBe("unknown");
    expect(detectActor(undefined, { AI_AGENT: "  " }, false)).toBe("unknown");
  });
});
