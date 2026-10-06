import { ShelfError } from "../errors.ts";
import type { Skill } from "./types.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const RELATIVE = /^([+-])(\d+)([dw])$/;
const ABSOLUTE = /^\d{4}-\d{2}-\d{2}$/;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * A skill's loan length: its own setting, else the configured default. Capped at
 * the loan limit, which may have been lowered since the skill's length was set.
 */
export function effectiveLoanDays(
  skill: Pick<Skill, "loanDays">,
  config: { readonly loanDays: number; readonly maxLoanDays: number },
): number {
  return Math.min(skill.loanDays ?? config.loanDays, config.maxLoanDays);
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
  return parsePositiveInt(value, fallback, "--days");
}

export function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  flag: string,
): number {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new ShelfError("INVALID_ARGUMENT", `${flag} must be a positive integer, got "${value}"`);
  }
  return number;
}
