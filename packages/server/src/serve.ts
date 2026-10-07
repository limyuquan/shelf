import { type Context, ShelfError, type SystemOptions } from "@shelf/core";
import type { HTMLBundle } from "bun";
import { createApi } from "./app.ts";
import { watchChanges } from "./changes.ts";

export interface DashboardServer {
  readonly url: string;
  readonly port: number;
  stop(): Promise<void>;
}

export interface ServeOptions {
  /** The web app's `index.html`, imported by the caller (`import page from "…/index.html"`). */
  readonly page: HTMLBundle;
  /** Version, bundled skill and hook command, for the settings page and repairs. */
  readonly system: SystemOptions;
  readonly port?: number;
  /** Rebuild the web app on every reload, for working on it (`bun run dev`). */
  readonly development?: boolean;
  /** The access token (see `loadToken`). */
  readonly token: string;
}

/** A long-lived reader can keep the WAL from shrinking; checkpoint periodically. */
const CHECKPOINT_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Serves the dashboard on 127.0.0.1 only. API calls must carry the token and a
 * Host header naming this server, so neither other local users' browsers nor
 * DNS-rebinding pages can drive it. Every non-API path serves the web app,
 * which routes on the client.
 */
export function startServer(ctx: Context, options: ServeOptions): DashboardServer {
  const { token } = options;
  let hosts: ReadonlySet<string> = new Set();
  const changes = watchChanges(ctx);
  const api = createApi(
    ctx,
    { token, isAllowedHost: (host) => hosts.has(host) },
    options.system,
    changes,
  );

  let server: Bun.Server<undefined>;
  try {
    server = Bun.serve({
      hostname: "127.0.0.1",
      port: options.port ?? 0,
      // Never share a port with another process: a second `shelf ui` on the same
      // port must fail rather than silently answer half of the requests.
      reusePort: false,
      routes: {
        "/api/*": (request) => api.fetch(request),
        // The live-update stream is quiet between changes and heartbeats; don't let
        // the idle timeout (10 s by default) cut it.
        "/api/events": (request, server) => {
          server.timeout(request, 0);
          return api.fetch(request);
        },
        "/*": options.page,
      },
      // Bun rebuilds the app on reload in development. Hot module replacement stays
      // off: its module runtime breaks on TanStack Router's circular imports.
      development: options.development ? { hmr: false, console: true } : false,
    });
  } catch (error) {
    changes.close();
    throw portInUse(error, options.port ?? 0);
  }
  const port = server.port as number;
  hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);

  const checkpoint = setInterval(
    () => ctx.db.run("PRAGMA wal_checkpoint(TRUNCATE)"),
    CHECKPOINT_INTERVAL_MS,
  );
  return {
    url: `http://127.0.0.1:${port}/?token=${token}`,
    port,
    async stop() {
      clearInterval(checkpoint);
      changes.close();
      await server.stop(true);
    },
  };
}

/** A port in use is for the user to resolve (often a dashboard already running), not a crash. */
function portInUse(error: unknown, port: number): unknown {
  if ((error as { code?: unknown } | null)?.code !== "EADDRINUSE") return error;
  return new ShelfError(
    "CONFLICT",
    `Port ${port} is already in use`,
    `If it is another \`shelf ui\`, the dashboard is already at http://127.0.0.1:${port}/; otherwise choose another port with --port, or leave it out for a free one`,
  );
}
