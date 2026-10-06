/** Display formatting. Pure functions, so they are unit-tested in isolation. */

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "narrow" });

/** "2m ago", "in 5 days", "just now". */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = (new Date(iso).getTime() - now) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

/** "Oct 6", or "Oct 6, 2025" outside the current year. */
export function shortDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** "in 5 days", "due today", "3 days overdue". */
export function dueLabel(daysLeft: number): string {
  if (daysLeft < 0) return `${-daysLeft} day${daysLeft === -1 ? "" : "s"} overdue`;
  if (daysLeft === 0) return "due today";
  return `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
}

/** "sha256:9f86d0…" → "9f86d081". */
export function shortHash(hash: string, length = 8): string {
  return hash.replace(/^sha256:/, "").slice(0, length);
}

/** Replaces the home directory with `~` and keeps the last segments of long paths. */
export function shortPath(path: string, home?: string): string {
  const tilde = home && path.startsWith(home) ? `~${path.slice(home.length)}` : path;
  const parts = tilde.split("/");
  return parts.length > 5 ? `${parts.slice(0, 2).join("/")}/…/${parts.slice(-2).join("/")}` : tilde;
}

/** "agent:claude-code" → "claude-code", "user:dashboard" → "you (dashboard)". */
export function actorLabel(actor: string): string {
  if (actor === "user") return "you";
  if (actor.startsWith("user:")) return `you (${actor.slice(5)})`;
  if (actor.startsWith("agent:")) return actor.slice(6);
  return actor;
}

/** "github.com/get-convex/agent-skills" from a git URL. */
export function sourceLabel(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\.git$/, "");
}
