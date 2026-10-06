/**
 * Pure helpers for selecting rows by key: toggling one, a shift-click range or
 * a whole group, and dropping keys whose rows have gone. Unit-tested; the
 * `useSelection` hook holds the state.
 */

export type SelectionState = "all" | "some" | "none";

/** How much of `keys` is selected, for a select-all checkbox. */
export function selectionState(
  selected: ReadonlySet<string>,
  keys: readonly string[],
): SelectionState {
  const count = keys.filter((key) => selected.has(key)).length;
  if (count === 0) return "none";
  return count === keys.length ? "all" : "some";
}

/** Adds (`on`) or removes keys. */
export function setKeys(
  selected: ReadonlySet<string>,
  keys: readonly string[],
  on: boolean,
): Set<string> {
  const next = new Set(selected);
  for (const key of keys) {
    if (on) next.add(key);
    else next.delete(key);
  }
  return next;
}

/**
 * The keys from `anchor` to `key` in list order, both included. Without an
 * anchor still in the list, just `key`.
 */
export function rangeKeys(order: readonly string[], anchor: string | null, key: string): string[] {
  const to = order.indexOf(key);
  if (to === -1) return [];
  const from = anchor === null ? -1 : order.indexOf(anchor);
  if (from === -1) return [key];
  return order.slice(Math.min(from, to), Math.max(from, to) + 1);
}

/**
 * Toggles one row. With `range` (shift-click), every row between the anchor
 * (the last row toggled) and this one takes this row's new state, like a file
 * manager.
 */
export function toggleKey(
  selected: ReadonlySet<string>,
  order: readonly string[],
  key: string,
  options: { anchor?: string | null; range?: boolean } = {},
): Set<string> {
  const on = !selected.has(key);
  const keys = options.range ? rangeKeys(order, options.anchor ?? null, key) : [key];
  return setKeys(selected, keys, on);
}

/** Selects every key, or none when all already are. */
export function toggleAll(selected: ReadonlySet<string>, keys: readonly string[]): Set<string> {
  return setKeys(selected, keys, selectionState(selected, keys) !== "all");
}

/**
 * The selection limited to keys still in the list, e.g. after a return or a
 * live update. Returns `selected` itself when nothing was dropped.
 */
export function pruneSelection(
  selected: ReadonlySet<string>,
  keys: readonly string[],
): ReadonlySet<string> {
  const present = new Set(keys);
  if ([...selected].every((key) => present.has(key))) return selected;
  return new Set([...selected].filter((key) => present.has(key)));
}
