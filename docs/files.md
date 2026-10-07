# Files

Everything shelf reads and writes: the shelf home (`~/.shelf`), the files in your home directory and harness configs, the files in each project, and temporary files. Useful for backups, uninstalling, and knowing what to commit.

## The shelf home

`~/.shelf`, or `$SHELF_HOME` when set (see [Environment](environment.md)).

```
~/.shelf/
  config.json                 your settings
  shelf.db                    projects, loans, due dates, sets, sources, activity
  shelf.db-wal, shelf.db-shm  SQLite's write-ahead log (while in use)
  library/<skill>/            the editable copy of each skill
  objects/<hash>/             an immutable snapshot of every revision
  archive/<skill>-<time>/     skills moved out by shelf archive
  ui-token                    the dashboard's access token
```

| Path | Created by | Contents |
|---|---|---|
| `config.json` | `shelf setup` | Settings; see [Configuration](configuration.md). |
| `shelf.db` | The first command | SQLite: registered projects, loans and due dates, skills and revisions (metadata), skill sources, sets, per-skill loan lengths, and the activity log. Per machine. |
| `library/<skill>/` | `new`, `add`, `adopt`, `pull`, `restore`, `promote`, you | Plain skill folders. Edit them with any tool. |
| `objects/<hash>/` | Every recorded revision | A full copy of the skill at that revision, named by the hex part of its hash. Projects are always copied from here. Never deleted, except orphans removed by `shelf doctor --fix`. |
| `archive/<skill>-<time>/` | `shelf archive` | The archived skill directory, with a UTC timestamp like `2026-10-07T05-35-15`. Move it back into `library/` to restore. |
| `ui-token` | `shelf ui` | 32 characters, file mode 0600. Delete it or run `shelf ui --rotate-token` to sign out every browser. |

To back up your skills, copy `library/`. To keep everything (history, loans, activity), copy the whole directory while no shelf command is running.

Files named `*.shelf-<uuid>` are staging files of a write in progress; a leftover one means a write was interrupted, and `shelf doctor --fix` removes it.

## Your home directory

| Path | Written by | Contents |
|---|---|---|
| `~/.agents/skills/shelf/SKILL.md` | `shelf setup` | The bundled `shelf` skill, for harnesses that read `~/.agents/skills`. |
| `~/.claude/skills/shelf/SKILL.md` | `shelf setup` | The same, for Claude Code. |
| `~/.<harness>/skills/shelf/SKILL.md` | `shelf setup` | The same, for each installed harness that doesn't read `~/.agents/skills` (Kiro, Junie, Qwen Code, Trae, OpenHands). |
| `~/.claude/settings.json` | `shelf setup` | shelf's hook entries, next to your other settings. `$CLAUDE_CONFIG_DIR` moves it. |
| `~/.codex/hooks.json` | `shelf setup` | shelf's hook entries. `$CODEX_HOME` moves it. |

shelf reads, but never writes, the other skills in user-level skill directories (`~/.claude/skills`, `~/.copilot/skills`, `~/.config/opencode/skills` and the rest) to count them in `shelf insights`.

## Each project

| Path | Contents | Commit it? |
|---|---|---|
| `.agents/shelf.lock.json` | Which skills shelf manages, at which revision, where, and whether kept. See [Lockfile](lockfile.md). | Yes. |
| `<target>/<skill>/` | A borrowed skill's copy (or, in link mode, a symlink to the first target's copy), for example `.claude/skills/pdf-tools/`. | Your choice; see [Lockfile](lockfile.md#commit-it). |

shelf writes only skill directories it manages. It never writes into an unmanaged directory with a skill's name (that is a `CONFLICT`), and never modifies SKILL.md frontmatter in a project. Copies are written to a staging directory next to the target and renamed into place, so a harness never reads a half-written skill.

`shelf return` and expiry delete a loan's copies; `shelf detach` leaves them.

## Temporary files

`shelf add` and `shelf pull` clone git sources into a `shelf-source-*` directory in the system temp directory and delete it when done.

## Related

- [Installation: uninstalling](installation.md#uninstalling)
- [Environment](environment.md), [Configuration](configuration.md)
