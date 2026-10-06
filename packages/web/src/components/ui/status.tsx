import { cn } from "../../lib/cn.ts";

export type Tone = "neutral" | "green" | "yellow" | "orange" | "red" | "blue" | "violet" | "accent";

const DOT: Record<Tone, string> = {
  neutral: "bg-fg-subtle",
  green: "bg-green",
  yellow: "bg-yellow",
  orange: "bg-orange",
  red: "bg-red",
  blue: "bg-blue",
  violet: "bg-violet",
  accent: "bg-accent",
};

const TEXT: Record<Tone, string> = {
  neutral: "text-fg-muted",
  green: "text-green",
  yellow: "text-yellow",
  orange: "text-orange",
  red: "text-red",
  blue: "text-blue",
  violet: "text-violet",
  accent: "text-accent",
};

export function StatusDot({ tone, className }: { tone: Tone; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", DOT[tone], className)} />;
}

/** A compact label with a coloured dot, e.g. `● behind`. */
export function StatusPill({ tone, children }: { tone: Tone; children: string }) {
  return (
    <span className="inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-2 text-[12px] text-fg-muted">
      <StatusDot tone={tone} className="size-1.5" />
      {children}
    </span>
  );
}

export function toneText(tone: Tone): string {
  return TEXT[tone];
}
