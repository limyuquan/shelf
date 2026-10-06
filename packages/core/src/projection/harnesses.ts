/**
 * Where coding agents discover skills. Adding a harness is a one-entry change.
 *
 * Two directories cover nearly every harness today: `.agents/skills` is the
 * cross-harness convention and Claude Code reads only `.claude/skills`. The rest
 * are listed so projects can opt into them with `shelf targets --add <id>` —
 * needed only for harnesses that do not read `.agents/skills` (e.g. Kiro).
 * See docs/harnesses.md for the matrix and sources.
 */
export interface Harness {
  readonly id: string;
  readonly label: string;
  /** Skill directory relative to a project root. */
  readonly projectDir: string;
  /** Skill directory relative to the user's home. */
  readonly userDir: string;
  /** Also discovers skills in `.agents/skills`, so needs no target of its own. */
  readonly readsAgentsDir: boolean;
  /** Written by default and given the bundled `shelf` skill by `shelf setup`. */
  readonly isDefault: boolean;
}

const harness = (
  id: string,
  label: string,
  dir: string,
  options: { readsAgentsDir: boolean; isDefault?: boolean; userDir?: string },
): Harness => ({
  id,
  label,
  projectDir: `${dir}/skills`,
  userDir: options.userDir ?? `${dir}/skills`,
  readsAgentsDir: options.readsAgentsDir,
  isDefault: options.isDefault ?? false,
});

export const HARNESSES: readonly Harness[] = [
  harness("agents", "Agent Skills convention (Codex, Cursor, Gemini CLI, Copilot, …)", ".agents", {
    readsAgentsDir: true,
    isDefault: true,
  }),
  harness("claude", "Claude Code", ".claude", { readsAgentsDir: false, isDefault: true }),
  harness("kiro", "Kiro", ".kiro", { readsAgentsDir: false }),
  harness("github", "GitHub Copilot", ".github", {
    readsAgentsDir: true,
    userDir: ".copilot/skills",
  }),
  harness("cursor", "Cursor", ".cursor", { readsAgentsDir: true }),
  harness("gemini", "Gemini CLI", ".gemini", { readsAgentsDir: true }),
  harness("opencode", "OpenCode", ".opencode", {
    readsAgentsDir: true,
    userDir: ".config/opencode/skills",
  }),
  harness("devin", "Windsurf / Devin", ".devin", {
    readsAgentsDir: true,
    userDir: ".config/devin/skills",
  }),
  harness("windsurf", "Windsurf (legacy)", ".windsurf", {
    readsAgentsDir: true,
    userDir: ".codeium/windsurf/skills",
  }),
  harness("roo", "Roo Code", ".roo", { readsAgentsDir: true }),
  harness("cline", "Cline", ".cline", { readsAgentsDir: true }),
  harness("factory", "Factory Droid", ".factory", { readsAgentsDir: true }),
  harness("goose", "Goose", ".goose", { readsAgentsDir: true, userDir: ".config/goose/skills" }),
  harness("junie", "Junie", ".junie", { readsAgentsDir: false }),
  harness("qwen", "Qwen Code", ".qwen", { readsAgentsDir: false }),
  harness("trae", "Trae", ".trae", { readsAgentsDir: false }),
  harness("openhands", "OpenHands", ".openhands", { readsAgentsDir: false }),
];

export const DEFAULT_TARGETS: readonly string[] = HARNESSES.filter((h) => h.isDefault).map(
  (h) => h.projectDir,
);

export function findHarness(idOrDir: string): Harness | undefined {
  return HARNESSES.find((h) => h.id === idOrDir || h.projectDir === idOrDir);
}
