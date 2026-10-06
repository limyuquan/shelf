import { ShelfError } from "../errors.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const RELATIVE = /^([+-])(\d+)([dw])$/;
const ABSOLUTE = /^\d{4}-\d{2}-\d{2}$/;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Resolves a due-date expression against the current due date:
 * `+14d` / `-7d` / `+2w` shift it, `2026-12-01` replaces it (end of that day, UTC).
 */
export function parseDueExpression(expression: string, currentDue: Date): Date {
  const relative = RELATIVE.exec(expression);
  if (relative) {
    const [, sign, amount, unit] = relative;
    const days = Number(amount) * (unit === "w" ? 7 : 1);
    return addDays(currentDue, sign === "-" ? -days : days);
  }
  if (ABSOLUTE.test(expression)) {
    const date = new Date(`${expression}T23:59:59.999Z`);
    if (!Number.isNaN(date.getTime())) return date;
  }
  throw new ShelfError(
    "INVALID_ARGUMENT",
    `Invalid due date "${expression}"`,
    "Use a relative shift like +14d, -7d, +2w or a date like 2026-12-01",
  );
}

export function parseDays(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const days = Number(value);
  if (!Number.isInteger(days) || days <= 0) {
    throw new ShelfError("INVALID_ARGUMENT", `--days must be a positive integer, got "${value}"`);
  }
  return days;
}
