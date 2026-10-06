import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ConfigSchema } from "../config.ts";
import { pathExists, writeFileAtomic } from "../library/fs.ts";
import { SKILL_FILE } from "../library/skill-file.ts";
import { HARNESSES } from "../projection/harnesses.ts";
import type { Context } from "./context.ts";
import { type HookChange, installHooks, removeHooks } from "./hooks.ts";

export interface SetupResult {
  readonly home: string;
  readonly library: string;
  /** Harness-wide paths where the bundled `shelf` skill was written or refreshed. */
  readonly installed: string[];
  readonly hooks: HookChange[];
}

export interface SetupOptions {
  readonly bundledSkill: string;
  /** How hooks invoke shelf: the absolute path of this binary. */
  readonly hookCommand: string;
  /** Install harness hooks (default), or remove them when false. */
  readonly hooks?: boolean;
}

/**
 * Where the bundled skill belongs: the default harnesses' user skill directories,
 * plus those of any other harness that does not read `~/.agents/skills` and is
 * installed (its top-level config directory exists, e.g. `~/.kiro`).
 */
export async function bundledSkillFiles(ctx: Context): Promise<string[]> {
  const files: string[] = [];
  for (const harness of HARNESSES) {
    const configRoot = join(ctx.paths.userHome, harness.userDir.split("/")[0] ?? "");
    const wanted = harness.isDefault || (!harness.readsAgentsDir && (await pathExists(configRoot)));
    if (wanted) files.push(join(ctx.paths.userHome, harness.userDir, "shelf", SKILL_FILE));
  }
  return files;
}

/**
 * Creates the shelf home, installs the bundled `shelf` skill (see
 * `bundledSkillFiles`) so agents know shelf exists in every project, and installs
 * the harness hooks that renew loans on use (see `hooks.ts`). Safe to re-run; it
 * also refreshes the skill and hooks after upgrades or when the binary moves.
 */
export async function setup(ctx: Context, options: SetupOptions): Promise<SetupResult> {
  const hooks = options.hooks ?? true;
  await mkdir(ctx.paths.library, { recursive: true });
  await mkdir(ctx.paths.objects, { recursive: true });
  await writeConfig(ctx, { hooks });

  const installed: string[] = [];
  for (const file of await bundledSkillFiles(ctx)) {
    const current = await readFile(file, "utf8").catch(() => null);
    if (current !== options.bundledSkill) await writeFileAtomic(file, options.bundledSkill);
    installed.push(file);
  }
  return {
    home: ctx.paths.home,
    library: ctx.paths.library,
    installed,
    hooks: hooks ? await installHooks(ctx, options.hookCommand) : await removeHooks(ctx),
  };
}

/** Creates the config file with every default, or updates keys in the user's file. */
async function writeConfig(ctx: Context, values: { hooks: boolean }): Promise<void> {
  const raw = await readFile(ctx.paths.config, "utf8").catch(() => null);
  const current = raw === null ? ConfigSchema.parse({}) : (JSON.parse(raw) as object);
  const next = { ...current, ...values };
  if (raw === null || JSON.stringify(next) !== JSON.stringify(current)) {
    await writeFileAtomic(ctx.paths.config, `${JSON.stringify(next, null, 2)}\n`);
  }
}
