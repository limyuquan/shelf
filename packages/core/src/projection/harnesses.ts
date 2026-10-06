/**
 * Where coding agents discover skills. Adding a harness is a one-entry change.
 *
 * Two directories cover nearly every harness today: `.agents/skills` is the
 * cross-harness convention (Codex, Cursor, Gemini CLI, Copilot, OpenCode, Amp,
 * Goose, Cline, Factory, …) and Claude Code reads only `.claude/skills`.
 * See docs/harnesses.md for the full matrix and sources.
 */
export interface Harness {
  readonly id: string;
  readonly label: string;
  /** Skill directory relative to a project root. */
  readonly projectDir: string;
  /** Skill directory relative to the user's home. */
  readonly userDir: string;
}

export const HARNESSES: readonly Harness[] = [
  {
    id: "agents",
    label: "Agent Skills convention (Codex, Cursor, Gemini CLI, Copilot, OpenCode, Amp, …)",
    projectDir: ".agents/skills",
    userDir: ".agents/skills",
  },
  {
    id: "claude",
    label: "Claude Code",
    projectDir: ".claude/skills",
    userDir: ".claude/skills",
  },
];

export const DEFAULT_TARGETS: readonly string[] = HARNESSES.map((harness) => harness.projectDir);
