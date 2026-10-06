import { homedir } from "node:os";
import { join } from "node:path";

export interface ShelfPaths {
  /** Root of all shelf state. Override with SHELF_HOME. */
  readonly home: string;
  /** Editable skill sources, one directory per skill. */
  readonly library: string;
  /** Immutable, content-addressed snapshots of every revision. */
  readonly objects: string;
  readonly database: string;
  readonly config: string;
  /** The user's home directory, where harness-wide skill dirs live. */
  readonly userHome: string;
  /** Harness config directories that shelf installs hooks into. */
  readonly claudeConfig: string;
  readonly codexHome: string;
}

export function resolvePaths(env: Record<string, string | undefined> = process.env): ShelfPaths {
  const userHome = env.HOME ?? homedir();
  const home = env.SHELF_HOME ?? join(userHome, ".shelf");
  return {
    home,
    library: join(home, "library"),
    objects: join(home, "objects"),
    database: join(home, "shelf.db"),
    config: join(home, "config.json"),
    userHome,
    claudeConfig: env.CLAUDE_CONFIG_DIR ?? join(userHome, ".claude"),
    codexHome: env.CODEX_HOME ?? join(userHome, ".codex"),
  };
}
