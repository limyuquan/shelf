import { type Clock, systemClock } from "../clock.ts";
import { type Config, loadConfig } from "../config.ts";
import type { Actor } from "../domain/types.ts";
import { resolvePaths, type ShelfPaths } from "../paths.ts";
import { type Db, openDatabase } from "../store/database.ts";

/** Everything a service needs. Services never read globals; tests build their own. */
export interface Context {
  readonly paths: ShelfPaths;
  readonly config: Config;
  readonly db: Db;
  readonly clock: Clock;
  readonly actor: Actor;
  readonly cwd: string;
}

export interface ContextOptions {
  readonly cwd?: string;
  readonly actor?: Actor;
  readonly env?: Record<string, string | undefined>;
  readonly clock?: Clock;
}

export async function createContext(options: ContextOptions = {}): Promise<Context> {
  const paths = resolvePaths(options.env);
  return {
    paths,
    config: await loadConfig(paths.config),
    db: openDatabase(paths.database),
    clock: options.clock ?? systemClock,
    actor: options.actor ?? "user",
    cwd: options.cwd ?? process.cwd(),
  };
}

export function closeContext(ctx: Context): void {
  ctx.db.close();
}

/** The same context acting from another directory, e.g. a project found by `scan`. */
export function withCwd(ctx: Context, cwd: string): Context {
  return { ...ctx, cwd };
}
