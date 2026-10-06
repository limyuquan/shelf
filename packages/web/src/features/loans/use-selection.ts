import { useEffect, useMemo, useRef, useState } from "react";
import {
  pruneSelection,
  type SelectionState,
  selectionState,
  setKeys,
  toggleAll,
  toggleKey,
} from "./selection.ts";

/**
 * A set of selected rows, by key, over a list that can change underneath it
 * (live updates, returns): rows that disappear leave the selection, and don't
 * come back selected if they reappear.
 */
export function useSelection<T>(items: readonly T[], key: (item: T) => string) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  // The last row toggled, where a shift-click range starts.
  const anchor = useRef<string | null>(null);
  const keys = items.map(key);
  const signature = keys.join("\n");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `signature` stands for `keys`
  const order = useMemo(() => keys, [signature]);
  const selected = useMemo(() => pruneSelection(picked, order), [picked, order]);

  useEffect(() => {
    if (selected !== picked) setPicked(selected);
  }, [selected, picked]);

  const keysOf = (subset: readonly T[]) => subset.map(key);

  return {
    selected,
    /** The selected items, in list order. */
    items: items.filter((item) => selected.has(key(item))),
    size: selected.size,
    has: (item: T) => selected.has(key(item)),
    /** Toggles a row; `range` (shift-click) extends from the last row toggled. */
    toggle: (item: T, range = false) => {
      const k = key(item);
      setPicked(toggleKey(selected, order, k, { anchor: anchor.current, range }));
      anchor.current = k;
    },
    /** For select-all checkboxes: all of `subset`, or none of it when all are selected. */
    toggleAll: (subset: readonly T[] = items) => setPicked(toggleAll(selected, keysOf(subset))),
    state: (subset: readonly T[] = items): SelectionState =>
      selectionState(selected, keysOf(subset)),
    /** Keeps only these keys selected, e.g. the rows whose action failed. */
    retain: (retained: readonly string[]) => setPicked(setKeys(new Set(), retained, true)),
    clear: () => {
      anchor.current = null;
      setPicked(new Set());
    },
  };
}

export type Selection<T> = ReturnType<typeof useSelection<T>>;
