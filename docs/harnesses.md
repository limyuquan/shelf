# Harness skill discovery

Where each coding agent looks for project-level skills, as of October 2026.
shelf writes to `.agents/skills` and `.claude/skills` by default, which covers
every harness below except Kiro (and Antigravity, which is unclear).

| Harness | Project dirs | Reads `.agents/skills` | Reads `.claude/skills` |
|---|---|---|---|
| Claude Code | `.claude/skills` | No | Yes |
| Codex CLI | `.agents/skills` (each folder from the working dir up to the repo root) | Yes | No |
| Cursor | `.agents/skills`, `.cursor/skills` | Yes | Yes |
| Gemini CLI | `.gemini/skills`, `.agents/skills` (trusted workspaces only) | Yes | No |
| GitHub Copilot | `.github/skills`, `.claude/skills`, `.agents/skills` | Yes | Yes |
| OpenCode | `.opencode/skills`, `.claude/skills`, `.agents/skills` | Yes | Yes |
| Amp | `.agents/skills`, `.claude/skills` | Yes | Yes |
| Windsurf / Devin | `.devin/skills`, `.windsurf/skills` | Yes | When Claude config is enabled |
| Goose | `.agents/skills`, `.goose/skills`, `.claude/skills` | Yes | Yes |
| Cline | `.clinerules/skills`, `.cline/skills`, `.claude/skills`, `.agents/skills` | Yes | Yes |
| Roo Code | `.roo/skills`, `.agents/skills` | Yes | Undocumented |
| Factory Droid | `.factory/skills`, `.agents/skills` | Yes | Undocumented |
| Kiro | `.kiro/skills` | Undocumented | Undocumented |

Projects that use a harness outside the default two can add its directory with
`shelf targets --add <id>`; `shelf targets` marks which harnesses it detects.
The full list lives in `packages/core/src/projection/harnesses.ts`.

## Why copies, not symlinks

Symlinked skills have open or recent bugs in Cursor, Claude Code and Codex,
mostly on Windows. Windows-native apps cannot follow Linux symlinks inside WSL.
Copies work everywhere; shelf tracks them by hash instead. `--link` mode is
available for projects where symlinks are known to work.

## Frontmatter

The [Agent Skills spec](https://agentskills.io/specification) requires `name`
(1–64 chars of `[a-z0-9-]`, matching the directory) and `description` (≤ 1024
chars). The reference validator rejects unknown top-level keys, and some
harnesses silently skip skills that fail validation. shelf therefore never
writes its own fields into SKILL.md; all tracking data lives in the lockfile
and database.

## Sources

- Spec: https://agentskills.io/specification
- Claude Code: https://code.claude.com/docs/en/skills
- Codex: https://learn.chatgpt.com/docs/build-skills
- Cursor: https://cursor.com/docs/context/skills
- Gemini CLI: https://geminicli.com/docs/cli/skills/
- Copilot: https://docs.github.com/en/copilot/concepts/agents/about-agent-skills
- OpenCode: https://opencode.ai/docs/skills/
- Amp: https://ampcode.com/docs/customize/skills
- Windsurf / Devin: https://docs.devin.ai/desktop/cascade/skills
- Goose: https://goose-docs.ai/docs/guides/context-engineering/using-skills
- Cline: https://docs.cline.bot/features/skills
- Roo Code: https://roocodeinc.github.io/Roo-Code/features/skills
- Factory: https://docs.factory.com/cli/configuration/skills
- Kiro: https://kiro.dev/docs/skills/
