import { Hono } from "hono";
import type { AppEnv } from "../env.ts";

/** Keeps proxies and idle sockets from dropping a quiet stream. */
const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events: `event: change` whenever the database or library changes,
 * so open dashboards refetch. The browser reads it with `fetch` rather than
 * `EventSource`, which can't send the token header.
 */
export const eventRoutes = new Hono<AppEnv>().get("/", (c) => {
  const changes = c.get("changes");
  const signal = c.req.raw.signal;
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          cleanup();
        }
      };
      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      const unsubscribe = changes.subscribe(
        (at) => send(`event: change\ndata: ${JSON.stringify({ at })}\n\n`),
        () => cleanup(),
      );
      cleanup = () => {
        cleanup = () => {};
        clearInterval(heartbeat);
        unsubscribe();
        signal.removeEventListener("abort", onAbort);
        try {
          controller.close();
        } catch {
          // Already closed by the client going away.
        }
      };
      const onAbort = () => cleanup();
      signal.addEventListener("abort", onAbort);
      if (signal.aborted) return cleanup();
      // Flush the headers now so the client knows it is connected.
      send(": connected\n\n");
    },
    cancel() {
      cleanup();
    },
  });

  return c.body(body, 200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });
});
