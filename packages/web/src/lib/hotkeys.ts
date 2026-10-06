import { type RefCallback, useCallback, useEffect, useRef, useState } from "react";

/** Typing in a field or the editor must never trigger shortcuts. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/** A dialog or menu owns the keyboard while it is open. */
const overlayOpen = () => document.querySelector('[role="dialog"], [role="menu"]') !== null;

/**
 * Single-key shortcuts (no modifiers), active while the component is mounted.
 * The latest handlers are always used, so callers need not memoise them.
 */
export function useHotkeys(bindings: Record<string, (event: KeyboardEvent) => void>): void {
  const latest = useRef(bindings);
  latest.current = bindings;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      if (isTyping(event.target) || overlayOpen()) return;
      const handler = latest.current[event.key];
      if (handler) {
        event.preventDefault();
        handler(event);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/**
 * j/k (or arrows) move through a list, Enter opens the active item, and `keys`
 * act on it (e.g. `r` to renew). Returns props for each row.
 */
export function useListNavigation<T>(
  items: readonly T[],
  options: {
    onOpen?: (item: T) => void;
    keys?: Record<string, (item: T) => void>;
    /** Escape goes here first; return true when it handled it (e.g. cleared a selection). */
    onEscape?: () => boolean;
  } = {},
) {
  const [active, setActive] = useState<number | null>(null);
  const rows = useRef(new Map<number, HTMLElement>());
  const index = active !== null && active < items.length ? active : null;

  const move = (delta: number) => {
    const next = index === null ? (delta > 0 ? 0 : items.length - 1) : index + delta;
    const clamped = Math.max(0, Math.min(items.length - 1, next));
    setActive(clamped);
    rows.current.get(clamped)?.scrollIntoView({ block: "nearest" });
  };
  const withActive = (fn: ((item: T) => void) | undefined) => () => {
    const item = index === null ? undefined : items[index];
    if (fn && item !== undefined) fn(item);
  };

  useHotkeys({
    j: () => move(1),
    ArrowDown: () => move(1),
    k: () => move(-1),
    ArrowUp: () => move(-1),
    Enter: withActive(options.onOpen),
    Escape: () => {
      if (!options.onEscape?.()) setActive(null);
    },
    ...Object.fromEntries(
      Object.entries(options.keys ?? {}).map(([key, fn]) => [key, withActive(fn)]),
    ),
  });

  const rowProps = useCallback(
    (
      row: number,
    ): { "data-active": boolean; onMouseMove: () => void; ref: RefCallback<HTMLElement> } => ({
      "data-active": row === index,
      onMouseMove: () => {
        if (row !== index) setActive(row);
      },
      ref: (element) => {
        if (element) rows.current.set(row, element);
        else rows.current.delete(row);
      },
    }),
    [index],
  );
  return { active: index, rowProps };
}

/** Classes for a row that keyboard navigation can highlight. */
export const navigableRow =
  "data-[active=true]:bg-surface-hover data-[active=true]:shadow-[inset_2px_0_0_var(--accent)]";
