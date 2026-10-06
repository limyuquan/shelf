/** Small helpers for human-readable output. JSON output never goes through these. */

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDaysLeft(days: number): string {
  if (days < 0) return `${-days}d overdue`;
  if (days === 0) return "due today";
  return `${days}d left`;
}

export function formatLastUsed(usedAt: Date | null, now: Date): string {
  if (!usedAt) return "never";
  const days = Math.floor((now.getTime() - usedAt.getTime()) / 86_400_000);
  return days <= 0 ? "today" : `${days}d ago`;
}

export function truncate(text: string, max: number): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length <= max ? line : `${line.slice(0, max - 1)}…`;
}

/** Left-aligned columns separated by two spaces. */
export function table(rows: readonly (readonly string[])[]): string {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 0, cell.length);
    });
  }
  return rows
    .map((row) =>
      row
        .map((cell, index) => (index === row.length - 1 ? cell : cell.padEnd(widths[index] ?? 0)))
        .join("  "),
    )
    .join("\n");
}

export function lines(...parts: (string | false | null | undefined)[]): string {
  return parts.filter((part): part is string => typeof part === "string").join("\n");
}
