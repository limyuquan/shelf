import {
  closeContext,
  createContext,
  type HookPayload,
  mayUseSkill,
  recordUseFromHook,
  sessionNotice,
  used,
} from "@shelf/core";
import { defineCommand } from "citty";
import { positionals, shelfCommand } from "../command.ts";
import { formatDate, lines } from "../format.ts";

/**
 * Entry point for the hooks `shelf setup` installs in Claude Code and Codex. The
 * harness passes a JSON payload on stdin. It never fails the agent's turn: errors
 * go to stderr (the harness's debug log) and the exit code is always 0.
 */
export const hookCommand = defineCommand({
  meta: {
    name: "hook",
    description: "Run a harness hook (installed by `shelf setup`; reads the payload on stdin)",
    hidden: true,
  },
  args: {
    event: { type: "positional", required: true, description: "session-start | skill-use" },
    harness: { type: "string", description: "Which harness runs the hook, e.g. claude-code" },
  },
  async run({ args }) {
    try {
      const output = await runHook(args.event, args.harness ?? "unknown");
      if (output) process.stdout.write(`${output}\n`);
    } catch (error) {
      console.error(`shelf hook ${args.event}: ${error instanceof Error ? error.message : error}`);
    }
  },
});

async function runHook(event: string, harness: string): Promise<string | null> {
  const payload = parsePayload(await Bun.stdin.text());
  if (event === "skill-use" && !mayUseSkill(payload)) return null;
  if (event !== "skill-use" && event !== "session-start") {
    throw new Error(`unknown hook event "${event}"`);
  }
  const ctx = await createContext({
    actor: `agent:${harness}`,
    ...(payload.cwd ? { cwd: payload.cwd } : {}),
  });
  try {
    if (event === "session-start") return await sessionNotice(ctx);
    await recordUseFromHook(ctx, payload);
    return null;
  } finally {
    closeContext(ctx);
  }
}

function parsePayload(raw: string): HookPayload {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as HookPayload) : {};
  } catch {
    return {};
  }
}

export const usedCommand = shelfCommand({
  name: "used",
  description: "Record that borrowed skills were used, which renews them (hooks do this for you)",
  args: { name: { type: "positional", required: true, description: "Skill names" } },
  async run(ctx, args) {
    const results = await used(ctx, positionals(args));
    return {
      data: { skills: results },
      text: lines(...results.map((r) => `${r.skill}: in use, due ${formatDate(r.dueAt)}`)),
    };
  },
});
