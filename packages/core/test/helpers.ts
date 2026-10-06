import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Clock } from "../src/clock.ts";
import { type Context, createContext } from "../src/services/context.ts";
import { createSkill } from "../src/services/library.ts";
import { initProject } from "../src/services/project.ts";

export const DAY = 24 * 60 * 60 * 1000;

export class FakeClock implements Clock {
  constructor(private current = new Date("2026-10-06T12:00:00.000Z")) {}
  now(): Date {
    return new Date(this.current);
  }
  advanceDays(days: number): void {
    this.current = new Date(this.current.getTime() + days * DAY);
  }
}

export interface TestEnv {
  readonly root: string;
  readonly projectDir: string;
  readonly shelfHome: string;
  readonly clock: FakeClock;
  readonly env: Record<string, string>;
  /** A fresh context over the same state, optionally in another directory. */
  context(cwd?: string): Promise<Context>;
}

/** An isolated HOME, SHELF_HOME and git project under a temp dir. */
export async function createTestEnv(): Promise<TestEnv> {
  const root = await mkdtemp(join(tmpdir(), "shelf-test-"));
  const projectDir = join(root, "project");
  await mkdir(join(projectDir, ".git"), { recursive: true });
  const shelfHome = join(root, ".shelf");
  const env = { HOME: root, SHELF_HOME: shelfHome };
  const clock = new FakeClock();
  return {
    root,
    projectDir,
    shelfHome,
    clock,
    env,
    context: (cwd = projectDir) => createContext({ cwd, env, clock, actor: "test" }),
  };
}

/** A context in an initialised project whose library holds the named skills. */
export async function setupProject(env: TestEnv, skills: readonly string[]): Promise<Context> {
  const ctx = await env.context();
  for (const name of skills) await createSkill(ctx, name, `The ${name} skill`);
  await initProject(ctx);
  return ctx;
}

export async function appendToFile(path: string, text: string): Promise<void> {
  const current = await Bun.file(path).text();
  await writeFile(path, current + text);
}
