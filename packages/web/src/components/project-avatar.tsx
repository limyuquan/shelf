import { cn } from "../lib/cn.ts";

const COLORS = [
  "#5e6ad2",
  "#26a69a",
  "#e2884b",
  "#c75ab2",
  "#4b9fe2",
  "#8f6ed5",
  "#d4a72c",
  "#d75f5f",
];

/** A stable colour per project name. */
export function projectColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length] as string;
}

/** A small square with the project's initial, like a workspace avatar. */
export function ProjectAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] font-semibold text-[9.5px] text-white",
        className,
      )}
      style={{ background: projectColor(name) }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
