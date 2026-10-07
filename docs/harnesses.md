# Harnesses

Where each coding agent looks for skills, which directories shelf writes to, how to add a harness's directory to a project with `shelf targets`, link mode, and why shelf copies skills instead of symlinking them.

## Default targets

shelf writes borrowed skills to two directories in each project:

| Target | Read by |
|---|---|
| `.agents/skills` | The cross-harness convention: Codex, Cursor, Gemini CLI, GitHub Copilot, OpenCode, Amp, Goose, Cline, Roo Code, Factory Droid, Windsurf / Devin |
| `.claude/skills` | Claude Code (and Cursor, Copilot, OpenCode, Amp, Goose and Cline also read it) |

These two cover every harness below except Kiro and a few that document neither directory. Change the default for all your projects with `targets` in the [config](configuration.md); change it for one project with `shelf targets`.

## Where each harness looks

As of October 2026:

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

## Harness ids

`shelf targets` knows these harnesses. Use the id (or the directory) with `--add` and `--remove`.

| Id | Harness | Project directory | User directory | Reads `.agents/skills` |
|---|---|---|---|---|
| `agents` | Agent Skills convention | `.agents/skills` | `~/.agents/skills` | yes (default target) |
| `claude` | Claude Code | `.claude/skills` | `~/.claude/skills` | no (default target) |
| `kiro` | Kiro | `.kiro/skills` | `~/.kiro/skills` | no |
| `github` | GitHub Copilot | `.github/skills` | `~/.copilot/skills` | yes |
| `cursor` | Cursor | `.cursor/skills` | `~/.cursor/skills` | yes |
| `gemini` | Gemini CLI | `.gemini/skills` | `~/.gemini/skills` | yes |
| `opencode` | OpenCode | `.opencode/skills` | `~/.config/opencode/skills` | yes |
| `devin` | Windsurf / Devin | `.devin/skills` | `~/.config/devin/skills` | yes |
| `windsurf` | Windsurf (legacy) | `.windsurf/skills` | `~/.codeium/windsurf/skills` | yes |
| `roo` | Roo Code | `.roo/skills` | `~/.roo/skills` | yes |
| `cline` | Cline | `.cline/skills` | `~/.cline/skills` | yes |
| `factory` | Factory Droid | `.factory/skills` | `~/.factory/skills` | yes |
| `goose` | Goose | `.goose/skills` | `~/.config/goose/skills` | yes |
| `junie` | Junie | `.junie/skills` | `~/.junie/skills` | no |
| `qwen` | Qwen Code | `.qwen/skills` | `~/.qwen/skills` | no |
| `trae` | Trae | `.trae/skills` | `~/.trae/skills` | no |
| `openhands` | OpenHands | `.openhands/skills` | `~/.openhands/skills` | no |

The user directories matter in two places: `shelf setup` installs the bundled `shelf` skill in `~/.agents/skills` and `~/.claude/skills`, plus the user directory of any installed harness that doesn't read `.agents/skills` (for example `~/.kiro/skills` when `~/.kiro` exists). And `shelf insights` counts the skills in all of them as "loaded everywhere".

Only Claude Code and Codex get [hooks](hooks.md).

## Project targets

```console
$ shelf targets
Skills are written to: .agents/skills, .claude/skills (your default)

HARNESS    DIRECTORY              NOTE
agents     .agents/skills     on  detected
claude     .claude/skills     on  detected
kiro       .kiro/skills           detected
github     .github/skills         reads .agents/skills
cursor     .cursor/skills         reads .agents/skills
…
openhands  .openhands/skills      

Kiro is used here but does not read .agents/skills: shelf targets --add kiro
```

`detected` means the harness's config directory (such as `.kiro/`) exists in the project. shelf suggests adding a detected harness that doesn't read `.agents/skills` and isn't already covered.

```console
$ shelf targets --add kiro
Skills are written to: .agents/skills, .claude/skills, .kiro/skills
…
```

Changing targets moves every loan in the project: copies appear in added directories and are removed from removed ones. The project's targets are written to its lockfile (`"targets": [...]`), so every clone uses them.

| Option | Effect |
|---|---|
| `--add ids` | Add harness ids or project-relative directories (comma-separated). |
| `--remove ids` | Remove them. Copies with local edits are refused unless `--force`. |
| `--reset` | Go back to your default targets from the config, and drop the lockfile's `targets`. |
| `--force` | Remove copies even if they have local edits. |

A directory that isn't a known harness works too, as long as it is inside the project: `shelf targets --add tools/agent-skills`. A project needs at least one target.

### Symlinked harness directories

Some projects symlink one harness directory to another, such as `.claude/skills` → `.agents/skills`. shelf compares targets by their real path: aliases are written once, never turned into a link to themselves, and removing one name never deletes the copy behind the other. `shelf targets` notes such a harness as `same directory as … (symlink)`.

## Link mode

By default every target holds its own copy. In link mode, the first target holds the only real copy and the others are relative symlinks to it (junctions on Windows):

```console
$ shelf borrow pdf-tools --link
Borrowed pdf-tools (due 2026-11-06) → .agents/skills, .claude/skills

$ ls -l .claude/skills
lrwxrwxrwx 1 me me 30 Oct  7 13:35 pdf-tools -> ../../.agents/skills/pdf-tools
```

Use `--link` per loan, or `"mode": "link"` in the [config](configuration.md) for every new loan. The lockfile records `"mode": "link"` for such loans. Hashing follows symlinks, so content states work the same in both modes.

## Why copies, not symlinks

Symlinked skills have open or recent bugs in Cursor, Claude Code and Codex, mostly on Windows, and Windows-native apps can't follow Linux symlinks inside WSL. Copies work everywhere, and shelf tracks them by hash, so they can't drift unnoticed. Use link mode in projects where you know symlinks work.

## Frontmatter

The Agent Skills spec requires `name` (1 to 64 characters of `[a-z0-9-]`, matching the directory) and `description` (at most 1024 characters). The reference validator rejects unknown top-level keys, and some harnesses silently skip skills that fail validation. shelf therefore never writes its own fields into SKILL.md; all tracking data lives in the lockfile and the database.

## Adding a harness to shelf

Harnesses are one entry each in `packages/core/src/projection/harnesses.ts`. Add the entry and a row to the tables on this page. See [Architecture](architecture.md#extending).

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
