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
 * Creates the shelf home and installs the bundled `shelf` skill (see
 * `bundledSkillFiles`), so agents know shelf exists in every project. Safe to
 * re-run; it also refreshes the bundled skill after upgrades.
 */
export async function setup(ctx: Context, bundledSkill: string): Promise<SetupResult> {
  await mkdir(ctx.paths.library, { recursive: true });
  await mkdir(ctx.paths.objects, { recursive: true });
  if (!(await pathExists(ctx.paths.config))) {
    await writeFileAtomic(ctx.paths.config, `${JSON.stringify(ConfigSchema.parse({}), null, 2)}\n`);
  }

  const installed: string[] = [];
  for (const file of await bundledSkillFiles(ctx)) {
    const current = await readFile(file, "utf8").catch(() => null);
    if (current !== bundledSkill) await writeFileAtomic(file, bundledSkill);
    installed.push(file);
  }
  return { home: ctx.paths.home, library: ctx.paths.library, installed };
}
