import type { Actor } from "@shelf/core";

/**
 * Environment variables that identify the agent harness running shelf, innermost
 * first: harnesses pass their environment on, so a Codex session started from
 * Claude Code sees both CODEX_* and CLAUDECODE, and Codex is the one running us.
 */
const HARNESS_ENV: readonly (readonly [variable: string, actor: Actor])[] = [
  ["CODEX_THREAD_ID", "agent:codex"],
  ["CODEX_SESSION_ID", "agent:codex"],
  ["CLAUDECODE", "agent:claude-code"],
];

/**
 * Who is running this command, for the activity log. `--actor` wins, then
 * SHELF_ACTOR, then a known harness variable, then the generic AI_AGENT
 * variable some harnesses set (e.g. `claude-code_2-1-289_agent`); otherwise a
 * person at a terminal.
 */
export function detectActor(
  explicit: string | undefined,
  env: Record<string, string | undefined> = process.env,
  interactive = Boolean(process.stdin.isTTY),
): Actor {
  if (explicit) return explicit;
  if (env.SHELF_ACTOR) return env.SHELF_ACTOR;
  for (const [variable, actor] of HARNESS_ENV) {
    if (env[variable]) return actor;
  }
  const generic = env.AI_AGENT?.toLowerCase().match(/^[a-z][a-z0-9-]*/)?.[0];
  if (generic) return `agent:${generic}`;
  return interactive ? "user" : "unknown";
}
