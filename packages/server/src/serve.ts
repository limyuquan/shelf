import type { Context, SystemOptions } from "@shelf/core";
import type { HTMLBundle } from "bun";
import { createApi } from "./app.ts";

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
  /**
   * Extra Host values to accept, for reaching the dashboard through a proxy such
   * as Tailscale Serve: `name` matches any port, `name:port` only that port.
   */
  readonly allowedHosts?: readonly string[];
}

/** A long-lived reader can keep the WAL from shrinking; checkpoint periodically. */
const CHECKPOINT_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Serves the dashboard on 127.0.0.1 only. API calls must carry the token and a
 * Host header naming this server (or an allowed proxy), so neither other local
 * users' browsers nor DNS-rebinding pages can drive it. Every non-API path
 * serves the web app, which routes on the client.
 */
export function startServer(ctx: Context, options: ServeOptions): DashboardServer {
  const { token } = options;
  let isAllowedHost: (host: string) => boolean = () => false;
  const api = createApi(
    ctx,
    { token, isAllowedHost: (host) => isAllowedHost(host) },
    options.system,
  );

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: options.port ?? 0,
    routes: {
      "/api/*": (request) => api.fetch(request),
      "/*": options.page,
    },
    // Bun rebuilds the app on reload in development. Hot module replacement stays
    // off: its module runtime breaks on TanStack Router's circular imports.
    development: options.development ? { hmr: false, console: true } : false,
  });
  const port = server.port as number;
  isAllowedHost = hostMatcher([
    `127.0.0.1:${port}`,
    `localhost:${port}`,
    ...(options.allowedHosts ?? []),
  ]);

  const checkpoint = setInterval(
    () => ctx.db.run("PRAGMA wal_checkpoint(TRUNCATE)"),
    CHECKPOINT_INTERVAL_MS,
  );
  return {
    url: `http://127.0.0.1:${port}/?token=${token}`,
    port,
    async stop() {
      clearInterval(checkpoint);
      await server.stop(true);
    },
  };
}

/** `name:port` entries match exactly; bare names match any port. Case-insensitive. */
export function hostMatcher(entries: readonly string[]): (host: string) => boolean {
  const exact = new Set(entries.filter((e) => e.includes(":")).map((e) => e.toLowerCase()));
  const names = new Set(entries.filter((e) => !e.includes(":")).map((e) => e.toLowerCase()));
  return (host) => {
    const normalized = host.toLowerCase();
    return exact.has(normalized) || names.has(normalized.replace(/:\d+$/, ""));
  };
}
