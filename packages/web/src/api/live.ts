import type { QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { backoff, createSseParser, throttle } from "../lib/sse.ts";
import { authHeaders } from "./client.ts";

/** `connecting` before the first connection, `reconnecting` after losing one. */
export type LiveStatus = "connecting" | "live" | "reconnecting";

let status: LiveStatus = "connecting";
const watchers = new Set<() => void>();

function setStatus(next: LiveStatus): void {
  if (next === status) return;
  status = next;
  for (const watcher of watchers) watcher();
}

/** Whether the dashboard is receiving live updates. */
export function useLiveStatus(): LiveStatus {
  return useSyncExternalStore(
    (watcher) => {
      watchers.add(watcher);
      return () => watchers.delete(watcher);
    },
    () => status,
  );
}

/**
 * Follows `/api/events` and refetches everything when the server reports a
 * change (an agent's hook, the CLI, a library edit, another tab). Reconnects
 * with backoff, and disconnects while the tab is hidden: it refetches on its
 * return anyway. Returns a function that stops it.
 */
export function startLive(queryClient: QueryClient): () => void {
  const invalidate = throttle(() => void queryClient.invalidateQueries(), 500);
  let connection: AbortController | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;
  let connectedBefore = false;
  let stopped = false;

  const connect = async () => {
    retry = null;
    if (stopped || connection || document.visibilityState === "hidden") return;
    const abort = new AbortController();
    connection = abort;
    try {
      const response = await fetch("/api/events", {
        headers: authHeaders,
        signal: abort.signal,
        cache: "no-store",
      });
      if (!response.ok || !response.body) throw new Error(`Live updates (${response.status})`);
      failures = 0;
      setStatus("live");
      // Anything that changed while disconnected was missed.
      if (connectedBefore) invalidate();
      connectedBefore = true;
      const parse = createSseParser((event) => {
        if (event.event === "change") invalidate();
      });
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parse(value);
      }
    } catch {
      // A network error, the server going away, or our own abort.
    }
    // Paused or stopped on purpose: whoever aborted decides what happens next.
    if (abort.signal.aborted) return;
    connection = null;
    failures++;
    setStatus("reconnecting");
    retry = setTimeout(connect, backoff(failures));
  };

  const disconnect = () => {
    connection?.abort();
    connection = null;
    if (retry) clearTimeout(retry);
    retry = null;
  };

  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      disconnect();
      if (connectedBefore) setStatus("reconnecting");
    } else if (!connection) {
      if (retry) clearTimeout(retry);
      failures = 0;
      void connect();
    }
  };

  document.addEventListener("visibilitychange", onVisibility);
  void connect();
  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", onVisibility);
    disconnect();
    invalidate.cancel();
  };
}
