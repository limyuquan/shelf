import { describe, expect, test } from "bun:test";
import {
  pruneSelection,
  rangeKeys,
  selectionState,
  setKeys,
  toggleAll,
  toggleKey,
} from "../src/features/loans/selection.ts";

const ORDER = ["a", "b", "c", "d", "e"];
const sorted = (set: ReadonlySet<string>) => [...set].sort();

describe("selection", () => {
  test("toggles one row on and off", () => {
    const on = toggleKey(new Set(), ORDER, "b");
    expect(sorted(on)).toEqual(["b"]);
    expect(sorted(toggleKey(on, ORDER, "b"))).toEqual([]);
  });

  test("shift-click selects from the anchor to the row, in either direction", () => {
    expect(sorted(toggleKey(new Set(["b"]), ORDER, "d", { anchor: "b", range: true }))).toEqual([
      "b",
      "c",
      "d",
    ]);
    expect(sorted(toggleKey(new Set(["d"]), ORDER, "a", { anchor: "d", range: true }))).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  test("a range takes the clicked row's new state, so it can also deselect", () => {
    const all = new Set(ORDER);
    expect(sorted(toggleKey(all, ORDER, "d", { anchor: "b", range: true }))).toEqual(["a", "e"]);
  });

  test("a range without an anchor in the list toggles just the row", () => {
    expect(rangeKeys(ORDER, null, "c")).toEqual(["c"]);
    expect(rangeKeys(ORDER, "gone", "c")).toEqual(["c"]);
    expect(rangeKeys(ORDER, "a", "gone")).toEqual([]);
    expect(sorted(toggleKey(new Set(), ORDER, "c", { anchor: "gone", range: true }))).toEqual([
      "c",
    ]);
  });

  test("select-all reflects and toggles a group", () => {
    expect(selectionState(new Set(), ORDER)).toBe("none");
    expect(selectionState(new Set(["a"]), ORDER)).toBe("some");
    expect(selectionState(new Set(ORDER), ORDER)).toBe("all");
    expect(sorted(toggleAll(new Set(["a"]), ORDER))).toEqual(ORDER);
    expect(sorted(toggleAll(new Set(ORDER), ORDER))).toEqual([]);
    // A group's select-all leaves other groups' rows alone.
    expect(sorted(toggleAll(new Set(["x"]), ["a", "b"]))).toEqual(["a", "b", "x"]);
    expect(sorted(toggleAll(new Set(["a", "b", "x"]), ["a", "b"]))).toEqual(["x"]);
  });

  test("adds and removes many keys", () => {
    expect(sorted(setKeys(new Set(["a"]), ["b", "c"], true))).toEqual(["a", "b", "c"]);
    expect(sorted(setKeys(new Set(["a", "b"]), ["b", "z"], false))).toEqual(["a"]);
  });

  test("rows that disappear leave the selection", () => {
    const selected = new Set(["a", "c"]);
    expect(sorted(pruneSelection(selected, ["a", "b"]))).toEqual(["a"]);
    // Unchanged selections keep their identity, so React state isn't reset needlessly.
    expect(pruneSelection(selected, ORDER)).toBe(selected);
  });
});
