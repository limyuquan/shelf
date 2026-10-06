/** One dispatched Server-Sent Event. */
export interface SseEvent {
  readonly event: string;
  readonly data: string;
}

/**
 * An incremental Server-Sent Events parser for streams read with `fetch` (the
 * dashboard can't use `EventSource`: it can't send the token header). Feed it
 * decoded text in chunks of any size; it calls `onEvent` for each complete event.
 * Follows the spec's line handling: CR, LF or CRLF line ends, `:` comments, a
 * default event type of `message`, multi-line `data`, no event for empty data.
 */
export function createSseParser(onEvent: (event: SseEvent) => void): (chunk: string) => void {
  let buffer = "";
  let event = "";
  let data: string[] = [];
  // A chunk ended in CR: a following LF belongs to the same line end.
  let afterCr = false;

  const line = (text: string) => {
    if (text === "") {
      if (data.length > 0) onEvent({ event: event || "message", data: data.join("\n") });
      event = "";
      data = [];
      return;
    }
    if (text.startsWith(":")) return;
    const colon = text.indexOf(":");
    const field = colon === -1 ? text : text.slice(0, colon);
    let value = colon === -1 ? "" : text.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  };

  return (chunk) => {
    let text = chunk;
    if (afterCr && text.startsWith("\n")) text = text.slice(1);
    afterCr = false;
    buffer += text;
    let start = 0;
    for (let i = 0; i < buffer.length; i++) {
      const char = buffer[i];
      if (char !== "\r" && char !== "\n") continue;
      line(buffer.slice(start, i));
      if (char === "\r") {
        if (i + 1 === buffer.length) afterCr = true;
        else if (buffer[i + 1] === "\n") i++;
      }
      start = i + 1;
    }
    buffer = buffer.slice(start);
  };
}

/**
 * Calls `fn` at most once per `ms`: immediately if it hasn't run lately,
 * otherwise once at the end of the window, however many calls came in between.
 */
export function throttle(fn: () => void, ms: number): { (): void; cancel(): void } {
  let last = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = () => {
    timer = null;
    last = Date.now();
    fn();
  };
  const throttled = () => {
    if (timer) return;
    const wait = last + ms - Date.now();
    if (wait <= 0) run();
    else timer = setTimeout(run, wait);
  };
  throttled.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return throttled;
}

/** Reconnect delay after `failures` consecutive failures: 1 s doubling to 30 s. */
export function backoff(failures: number): number {
  return Math.min(1000 * 2 ** Math.max(failures - 1, 0), 30_000);
}
