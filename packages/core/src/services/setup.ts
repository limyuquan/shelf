import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ConfigSchema } from "../config.ts";
import { pathExists, writeFileAtomic } from "../library/fs.ts";
import { SKILL_FILE } from "../library/skill-file.ts";
import { HARNESSES } from "../projection/harnesses.ts";
import type { Context } from "./context.ts";

export interface SetupResult {
  readonly home: string;
  readonly library: string;
  /** Harness-wide paths where the bundled `shelf` skill was written or refreshed. */
  readonly installed: string[];
}

/**
 * Creates the shelf home and installs the bundled `shelf` skill into every
 * harness's user-level skill directory, so agents know shelf exists in all
 * projects. Safe to re-run; it also refreshes the bundled skill after upgrades.
 */
export async function setup(ctx: Context, bundledSkill: string): Promise<SetupResult> {
  await mkdir(ctx.paths.library, { recursive: true });
  await mkdir(ctx.paths.objects, { recursive: true });
  if (!(await pathExists(ctx.paths.config))) {
    await writeFileAtomic(ctx.paths.config, `${JSON.stringify(ConfigSchema.parse({}), null, 2)}\n`);
  }

  const installed: string[] = [];
  for (const harness of HARNESSES) {
    const file = join(ctx.paths.userHome, harness.userDir, "shelf", SKILL_FILE);
    const current = await readFile(file, "utf8").catch(() => null);
    if (current !== bundledSkill) await writeFileAtomic(file, bundledSkill);
    installed.push(file);
  }
  return { home: ctx.paths.home, library: ctx.paths.library, installed };
}
