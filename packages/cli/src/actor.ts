import type { Actor } from "@shelf/core";

/** Environment variables that identify the agent harness running shelf. */
const HARNESS_ENV: readonly (readonly [variable: string, actor: Actor])[] = [
  ["CLAUDECODE", "agent:claude-code"],
];

/**
 * Who is running this command, for the activity log. `--actor` wins, then
 * SHELF_ACTOR, then a known harness variable; otherwise a person at a terminal.
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
  return interactive ? "user" : "unknown";
}
