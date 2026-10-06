import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathExists, writeFileAtomic } from "../library/fs.ts";
import type { Context } from "./context.ts";

/**
 * Harness hooks make loans renew on use without the agent doing anything:
 *  - `shelf hook session-start` syncs the project and, only when something needs
 *    attention, prints one line that the harness adds to the agent's context.
 *  - `shelf hook skill-use` runs after tool calls and prompts, recognises a
 *    borrowed skill being used and slides its due date. It never prints.
 * Both harnesses use the same hooks.json schema; only the file differs.
 */

export type HookHarness = "claude-code" | "codex";

interface HookHandler {
  type: "command";
  command: string;
  timeout?: number;
}

interface HookGroup {
  matcher?: string;
  hooks: HookHandler[];
}

type HookConfig = Record<string, HookGroup[]>;

interface HarnessHooks {
  readonly harness: HookHarness;
  readonly label: string;
  /** The harness's config directory; hooks are installed only if it exists. */
  readonly dir: string;
  readonly file: string;
  /** Codex asks the user to trust new hooks once, in its `/hooks` view. */
  readonly needsTrust: boolean;
  readonly toolMatcher: string | undefined;
}

function harnesses(ctx: Context): HarnessHooks[] {
  return [
    {
      harness: "claude-code",
      label: "Claude Code",
      dir: ctx.paths.claudeConfig,
      file: join(ctx.paths.claudeConfig, "settings.json"),
      needsTrust: false,
      // The Skill tool, plus reading a skill's files directly.
      toolMatcher: "Skill|Read|Bash",
    },
    {
      harness: "codex",
      label: "Codex",
      dir: ctx.paths.codexHome,
      file: join(ctx.paths.codexHome, "hooks.json"),
      needsTrust: true,
      // Codex reads skills with shell commands; its tool names vary, so match all.
      toolMatcher: undefined,
    },
  ];
}

const SHELF_HOOK = /\bshelf(\.exe)?"?\s+hook\s+(session-start|skill-use)\b/;

function desiredHooks(target: HarnessHooks, command: string): HookConfig {
  const quoted = /[\s"'$`\\]/.test(command) ? `"${command.replaceAll('"', '\\"')}"` : command;
  const handler = (event: string, timeout: number): HookHandler => ({
    type: "command",
    command: `${quoted} hook ${event} --harness ${target.harness}`,
    timeout,
  });
  return {
    SessionStart: [{ hooks: [handler("session-start", 30)] }],
    PostToolUse: [
      {
        ...(target.toolMatcher ? { matcher: target.toolMatcher } : {}),
        hooks: [handler("skill-use", 10)],
      },
    ],
    UserPromptSubmit: [{ hooks: [handler("skill-use", 10)] }],
  };
}

export interface HookChange {
  readonly harness: HookHarness;
  readonly label: string;
  readonly file: string;
  /** `skipped`: the file is not valid JSON, so it was left alone (see `problem`). */
  readonly status: "installed" | "unchanged" | "removed" | "absent" | "skipped";
  readonly needsTrust: boolean;
  readonly problem?: string;
}

/**
 * Installs (or refreshes, e.g. after the binary moved) shelf's hooks for every
 * harness present on this machine, keeping all other settings and hooks intact.
 */
export async function installHooks(ctx: Context, command: string): Promise<HookChange[]> {
  return editHooks(ctx, (target, hooks) =>
    merge(withoutShelf(hooks), desiredHooks(target, command)),
  );
}

/** Removes shelf's hooks and nothing else. */
export async function removeHooks(ctx: Context): Promise<HookChange[]> {
  return editHooks(ctx, (_target, hooks) => withoutShelf(hooks));
}

/** Harnesses whose shelf hooks are missing or differ from what `installHooks` writes. */
export async function staleHooks(ctx: Context, command: string): Promise<HookChange[]> {
  const stale: HookChange[] = [];
  for (const target of harnesses(ctx)) {
    if (!(await pathExists(target.dir))) continue;
    const read = await readSettings(target.file);
    if ("problem" in read) {
      stale.push(change(target, "skipped", read.problem));
      continue;
    }
    const hooks = (read.settings.hooks ?? {}) as HookConfig;
    const wanted = merge(withoutShelf(hooks), desiredHooks(target, command));
    if (JSON.stringify(wanted) !== JSON.stringify(hooks)) stale.push(change(target, "absent"));
  }
  return stale;
}

async function editHooks(
  ctx: Context,
  edit: (target: HarnessHooks, hooks: HookConfig) => HookConfig,
): Promise<HookChange[]> {
  const changes: HookChange[] = [];
  for (const target of harnesses(ctx)) {
    if (!(await pathExists(target.dir))) continue;
    const read = await readSettings(target.file);
    if ("problem" in read) {
      changes.push(change(target, "skipped", read.problem));
      continue;
    }
    const { settings } = read;
    const before = (settings.hooks ?? {}) as HookConfig;
    const after = edit(target, before);
    if (JSON.stringify(after) === JSON.stringify(before)) {
      changes.push(change(target, "unchanged"));
      continue;
    }
    const { hooks: _hooks, ...rest } = settings;
    const next = Object.keys(after).length > 0 ? { ...rest, hooks: after } : rest;
    await writeFileAtomic(target.file, `${JSON.stringify(next, null, 2)}\n`);
    const installed = Object.values(after).some((groups) => groups.some(isShelfGroup));
    changes.push(change(target, installed ? "installed" : "removed"));
  }
  return changes;
}

function change(target: HarnessHooks, status: HookChange["status"], problem?: string): HookChange {
  return {
    harness: target.harness,
    label: target.label,
    file: target.file,
    status,
    needsTrust: target.needsTrust,
    ...(problem ? { problem } : {}),
  };
}

async function readSettings(
  file: string,
): Promise<{ settings: Record<string, unknown> } | { problem: string }> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return { settings: {} };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { settings: parsed as Record<string, unknown> };
    }
  } catch {}
  return { problem: `${file} is not a JSON object; add shelf's hooks by hand or fix the file` };
}

const isShelfGroup = (group: HookGroup) =>
  group.hooks?.some((handler) => SHELF_HOOK.test(handler.command ?? ""));

function withoutShelf(hooks: HookConfig): HookConfig {
  const result: HookConfig = {};
  for (const [event, groups] of Object.entries(hooks)) {
    const kept = groups
      .map((group) => ({
        ...group,
        hooks: group.hooks.filter((handler) => !SHELF_HOOK.test(handler.command ?? "")),
      }))
      .filter(
        (group, index) => group.hooks.length > 0 || !isShelfGroup(groups[index] as HookGroup),
      );
    if (kept.length > 0) result[event] = kept;
  }
  return result;
}

function merge(base: HookConfig, extra: HookConfig): HookConfig {
  const result: HookConfig = { ...base };
  for (const [event, groups] of Object.entries(extra)) {
    result[event] = [...(result[event] ?? []), ...groups];
  }
  return result;
}
