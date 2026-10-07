# Environment

The environment variables shelf reads: where its state lives, where harness configs are, how it detects which agent is acting, and a few that only matter for development and packaging.

## State and paths

| Variable | Default | Effect |
|---|---|---|
| `SHELF_HOME` | `$HOME/.shelf` | Where shelf keeps its config, database, library, object store, archive and dashboard token. |
| `HOME` | The OS home directory | Your home: the default `SHELF_HOME`, the user-level skill directories (`~/.agents/skills`, `~/.claude/skills`, …), and the base for harness config directories. On Windows, the OS home (`%USERPROFILE%`) is used when `HOME` isn't set. |
| `CLAUDE_CONFIG_DIR` | `$HOME/.claude` | Claude Code's config directory: `shelf setup` writes hooks to its `settings.json`. |
| `CODEX_HOME` | `$HOME/.codex` | Codex's config directory: `shelf setup` writes hooks to its `hooks.json`. |

`SHELF_HOME` is how you keep separate libraries, or test without touching your real one:

```sh
export SHELF_HOME="$(mktemp -d)"
shelf setup
```

`shelf setup` also writes to your user-level skill directories and harness configs, under `HOME`, `CLAUDE_CONFIG_DIR` and `CODEX_HOME`. Point those somewhere temporary too when experimenting.

## Actor detection

Every change is recorded in the activity log with an actor. shelf picks the first that applies:

| Order | Source | Actor |
|---|---|---|
| 1 | `--actor <name>` | `<name>` |
| 2 | `SHELF_ACTOR` | its value |
| 3 | `CODEX_THREAD_ID` or `CODEX_SESSION_ID` is set | `agent:codex` |
| 4 | `CLAUDECODE` is set | `agent:claude-code` |
| 5 | `AI_AGENT` is set | `agent:` plus its first word, lowercased: `claude-code_2-1-289_agent` gives `agent:claude-code` |
| 6 | stdin is a terminal | `user` |
| 7 | otherwise | `unknown` |

Codex is checked before Claude Code because harnesses pass their environment on: a Codex session started from Claude Code sees both, and Codex is the one running shelf. `AI_AGENT` lets any harness that sets it be recognised without changes to shelf.

Hooks don't use this order: they record `agent:<harness>` from their `--harness` option. The dashboard records `user:dashboard`.

The actor matters in one place besides the log: actors starting with `agent:` can't import skills from git sources unless `allowAgentImports` is `true`. Set `SHELF_ACTOR` for scheduled jobs (`SHELF_ACTOR=cron shelf sweep`) so their entries are named.

## Other variables

| Variable | Read by | Effect |
|---|---|---|
| `WSL_DISTRO_NAME` | `shelf ui` | When set, the browser is opened with `cmd.exe /c start` (Windows' browser from WSL) instead of `xdg-open`. |
| `GIT_TERMINAL_PROMPT` | `shelf add`, `shelf pull` | shelf sets it to `0` for its `git` calls, so git never waits for a password. Your other git environment (SSH agent, credential helpers) applies. |
| `TMPDIR` | `shelf add`, `shelf pull` | Where sources are cloned temporarily (the system temp directory). |
| `SHELF_BIN` | The e2e tests | Path of a compiled binary to test instead of the source. |
| `NPM_SCOPE` | `bun run pack:npm` | The npm scope to package under (default `@limyuquan`). |

## Related

- [Configuration](configuration.md), [Files](files.md)
- [Agents](agents.md#which-agent-acted)
