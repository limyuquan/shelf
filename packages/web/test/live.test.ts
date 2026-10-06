import { describe, expect, test } from "bun:test";
import { backoff, createSseParser, type SseEvent, throttle } from "../src/lib/sse.ts";

function parse(...chunks: string[]): SseEvent[] {
  const events: SseEvent[] = [];
  const push = createSseParser((event) => events.push(event));
  for (const chunk of chunks) push(chunk);
  return events;
}

describe("SSE parser", () => {
  test("parses named events and skips comments", () => {
    expect(parse(': connected\n\nevent: change\ndata: {"at":"x"}\n\n: ping\n\n')).toEqual([
      { event: "change", data: '{"at":"x"}' },
    ]);
  });

  test("defaults to message, joins data lines, and dispatches nothing without data", () => {
    expect(parse("data: a\ndata:b\n\nevent: change\n\nevent: empty\ndata\n\n")).toEqual([
      { event: "message", data: "a\nb" },
      { event: "empty", data: "" },
    ]);
  });

  test("waits for the blank line, across chunks split anywhere", () => {
    const frame = 'event: change\ndata: {"at":"x"}\n\n';
    expect(parse(frame.slice(0, frame.length - 1))).toEqual([]);
    for (let split = 1; split < frame.length; split++) {
      expect(parse(frame.slice(0, split), frame.slice(split))).toEqual([
        { event: "change", data: '{"at":"x"}' },
      ]);
    }
  });

  test("accepts CRLF and CR line ends, including CRLF split between chunks", () => {
    const expected = [{ event: "change", data: "1" }];
    expect(parse("event: change\r\ndata: 1\r\n\r\n")).toEqual(expected);
    expect(parse("event: change\rdata: 1\r\r")).toEqual(expected);
    expect(parse("event: change\r", "\ndata: 1\r", "\n\r", "\n")).toEqual(expected);
  });

  test("an event type does not leak into the next event", () => {
    expect(parse("event: change\ndata: 1\n\ndata: 2\n\n")).toEqual([
      { event: "change", data: "1" },
      { event: "message", data: "2" },
    ]);
  });
});

describe("throttle", () => {
  test("runs at once, then once at the end of the window for any number of calls", async () => {
    let calls = 0;
    const run = throttle(() => calls++, 60);
    run();
    expect(calls).toBe(1);
    run();
    run();
    run();
    expect(calls).toBe(1);
    await Bun.sleep(100);
    expect(calls).toBe(2);
    await Bun.sleep(100);
    expect(calls).toBe(2);
    run();
    expect(calls).toBe(3);
  });

  test("cancel drops a pending call", async () => {
    let calls = 0;
    const run = throttle(() => calls++, 30);
    run();
    run();
    run.cancel();
    await Bun.sleep(60);
    expect(calls).toBe(1);
  });
});

describe("backoff", () => {
  test("starts at a second and doubles up to 30 seconds", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 20].map(backoff)).toEqual([
      1000, 2000, 4000, 8000, 16_000, 30_000, 30_000, 30_000,
    ]);
  });
});
