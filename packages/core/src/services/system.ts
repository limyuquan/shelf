import type { Config } from "../config.ts";
import type { Context } from "./context.ts";
import { type DoctorCheck, doctor } from "./doctor.ts";
import { describeHooks, type HookStatus } from "./hooks.ts";

/** What the running binary provides, since core cannot know it. */
export interface SystemOptions {
  readonly version: string;
  readonly bundledSkill: string;
  readonly hookCommand: string;
}

export interface SystemReport {
  readonly version: string;
  readonly home: string;
  readonly library: string;
  readonly config: Config;
  readonly hooks: HookStatus[];
  readonly checks: DoctorCheck[];
}

/** Everything the dashboard's settings page shows: paths, config, hooks and health. */
export async function systemReport(ctx: Context, options: SystemOptions): Promise<SystemReport> {
  const [hooks, { checks }] = await Promise.all([
    describeHooks(ctx, options.hookCommand),
    doctor(ctx, options),
  ]);
  return {
    version: options.version,
    home: ctx.paths.home,
    library: ctx.paths.library,
    config: ctx.config,
    hooks,
    checks,
  };
}

/** `shelf doctor --fix`: repairs what can be repaired safely, including hooks. */
export async function repairSystem(ctx: Context, options: SystemOptions): Promise<DoctorCheck[]> {
  return (await doctor(ctx, { ...options, fix: true })).checks;
}
