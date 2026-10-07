/**
 * Puts the demo backend between the dashboard and the network: requests to
 * `/api/*` are answered from snapshot.json (next to index.html), everything
 * else goes to the real `fetch`. Also shows the read-only banner.
 */
import { createBackend, type DemoBackend, type Snapshot } from "./backend.ts";

declare global {
  interface Window {
    /** For the build's browser check: GET requests the snapshot could not answer. */
    __shelfDemo?: { misses: string[] };
  }
}

const realFetch = window.fetch.bind(window);

// Next to the bundle, wherever the demo is served from.
const backend: Promise<DemoBackend> = realFetch(new URL("snapshot.json", import.meta.url))
  .then((response) => {
    if (!response.ok) throw new Error(`Loading the demo data failed (${response.status})`);
    return response.json() as Promise<Snapshot>;
  })
  .then((snapshot) => {
    const created = createBackend(snapshot);
    window.__shelfDemo = { misses: created.misses };
    return created;
  });

/** The live-updates stream: connected, then quiet until the app hangs up. */
function eventStream(signal: AbortSignal): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(": connected\n\n"));
      signal.addEventListener("abort", () => {
        try {
          controller.error(new DOMException("The live-updates stream was closed", "AbortError"));
        } catch {
          // Already closed.
        }
      });
    },
  });
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.origin !== location.origin || !url.pathname.startsWith("/api/")) {
    return realFetch(input, init);
  }
  const body = request.method === "GET" || request.method === "HEAD" ? "" : await request.text();
  const result = (await backend).handle(request.method, url, body);
  if (result.kind === "events") return eventStream(request.signal);
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "content-type": "application/json" },
  });
}) as typeof fetch;

const DISMISSED = "shelf.demo.banner-dismissed";

function showBanner(): void {
  if (sessionStorage.getItem(DISMISSED)) return;
  const banner = document.createElement("div");
  banner.className = "demo-banner";
  banner.setAttribute("role", "note");
  const text = document.createElement("span");
  text.textContent = "Read-only demo on sample data";
  const link = document.createElement("a");
  link.href = "../#install";
  link.textContent = "Install shelf →";
  const close = document.createElement("button");
  close.type = "button";
  close.setAttribute("aria-label", "Hide this banner");
  close.textContent = "×";
  close.addEventListener("click", () => {
    sessionStorage.setItem(DISMISSED, "1");
    banner.remove();
    document.documentElement.classList.remove("has-demo-banner");
  });
  const sep = document.createElement("span");
  sep.className = "demo-banner-sep";
  sep.textContent = "·";
  banner.append(text, sep, link, close);
  document.body.prepend(banner);
  document.documentElement.classList.add("has-demo-banner");
}

showBanner();
