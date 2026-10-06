import { existsSync, type FSWatcher, watch } from "node:fs";
import type { Context } from "@shelf/core";

/** Fans "something changed" out to every connected dashboard. */
export interface ChangeFeed {
  /**
   * Calls `listener` with the time of each detected change, and `onClose` if the
   * feed closes first. Returns an unsubscribe.
   */
  subscribe(listener: (at: string) => void, onClose?: () => void): () => void;
  /** Stops watching and closes every subscription. */
  close(): void;
}

export interface ChangeFeedOptions {
  readonly pollMs?: number;
  readonly debounceMs?: number;
}

/**
 * Detects changes made by any process: agents' hooks and the CLI write the same
 * database from other connections, and users edit the library with any tool.
 *
 * `PRAGMA data_version` changes when another connection commits, and
 * `total_changes()` counts this connection's own writes (the dashboard's
 * mutations, so other tabs follow); polling both is a cheap query. The library
 * is watched with `fs.watch` where recursive watching works, and polling alone
 * covers the database everywhere else. Nothing runs while nobody is listening.
 */
export function watchChanges(ctx: Context, options: ChangeFeedOptions = {}): ChangeFeed {
  const pollMs = options.pollMs ?? 1000;
  const debounceMs = options.debounceMs ?? 300;
  const listeners = new Map<(at: string) => void, (() => void) | undefined>();
  const version = ctx.db.query<{ v: number; n: number }, []>(
    "SELECT (SELECT data_version FROM pragma_data_version) AS v, total_changes() AS n",
  );

  let poll: ReturnType<typeof setInterval> | null = null;
  let debounce: ReturnType<typeof setTimeout> | null = null;
  let watcher: FSWatcher | null = null;
  let watchUnsupported = false;
  let last = "";

  const read = () => {
    const row = version.get();
    return row ? `${row.v}:${row.n}` : "";
  };

  const emit = () => {
    debounce = null;
    const at = ctx.clock.now().toISOString();
    for (const listener of listeners.keys()) listener(at);
  };

  // Coalesces a burst (a skill copied file by file, a transaction plus its
  // lockfile) into one event, without letting a long burst postpone it forever.
  const changed = () => {
    debounce ??= setTimeout(emit, debounceMs);
  };

  // The library may not exist yet (shelf not initialised) or the platform may not
  // support recursive watching; retried on each poll until it works or can't.
  const watchLibrary = () => {
    if (watcher || watchUnsupported || !existsSync(ctx.paths.library)) return;
    try {
      watcher = watch(ctx.paths.library, { recursive: true }, changed);
      watcher.on("error", () => {
        watcher?.close();
        watcher = null;
      });
    } catch (error) {
      watcher = null;
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") watchUnsupported = true;
    }
  };

  const tick = () => {
    try {
      const current = read();
      if (current !== last) {
        last = current;
        changed();
      }
    } catch {
      // A busy or briefly locked database: try again on the next tick.
    }
    watchLibrary();
  };

  const start = () => {
    last = read();
    watchLibrary();
    poll = setInterval(tick, pollMs);
  };

  const stop = () => {
    if (poll) clearInterval(poll);
    if (debounce) clearTimeout(debounce);
    watcher?.close();
    poll = debounce = watcher = null;
  };

  return {
    subscribe(listener, onClose) {
      listeners.set(listener, onClose);
      if (!poll) start();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
      };
    },
    close() {
      const closing = [...listeners.values()];
      listeners.clear();
      stop();
      for (const onClose of closing) onClose?.();
    },
  };
}
