# shelf setup

Creates the shelf home, installs the bundled `shelf` skill for your agents, and installs the hooks that renew skills when they are used. Safe to re-run; run it again after every upgrade.

<!-- generated:cli setup -->
<!-- /generated -->

## What it does

1. Creates the shelf home (`~/.shelf`, or `$SHELF_HOME`) with `library/` and `objects/`.
2. Writes `config.json` with every default if it doesn't exist, and sets its `hooks` key to match `--hooks` / `--no-hooks`. Other keys you set are kept.
3. Writes the bundled `shelf` skill to `~/.agents/skills/shelf/SKILL.md` and `~/.claude/skills/shelf/SKILL.md`, plus the user skill directory of any installed harness that doesn't read `~/.agents/skills` (for example `~/.kiro/skills/shelf/SKILL.md` when `~/.kiro` exists). An existing copy is replaced only if it differs.
4. Installs shelf's [hooks](../hooks.md) in Claude Code (`~/.claude/settings.json`) and Codex (`~/.codex/hooks.json`) for each harness whose config directory exists. With `--no-hooks`, removes them instead.

Hooks call shelf by the absolute path of the running binary. Re-running `setup` after moving or upgrading the binary updates them.

## Examples

```console
$ shelf setup
Shelf home: /home/me/.shelf
Library:    /home/me/.shelf/library
Installed the shelf skill at:
  /home/me/.agents/skills/shelf/SKILL.md
  /home/me/.claude/skills/shelf/SKILL.md

Hooks (renew skills when used, report loans needing attention):
  Claude Code: hooks installed (/home/me/.claude/settings.json)
  Codex: hooks installed (/home/me/.codex/hooks.json)
Codex runs new hooks only after you trust them: open `/hooks` in Codex once.
```

Running it again reports `hooks up to date`. Without hooks:

```console
$ shelf setup --no-hooks
Shelf home: /home/me/.shelf
Library:    /home/me/.shelf/library
Installed the shelf skill at:
  /home/me/.agents/skills/shelf/SKILL.md
  /home/me/.claude/skills/shelf/SKILL.md

Hooks:
  Claude Code: hooks removed (/home/me/.claude/settings.json)
  Codex: hooks removed (/home/me/.codex/hooks.json)
```

If neither Claude Code nor Codex is installed, it says: "No Claude Code or Codex config found, so no hooks were installed: run `shelf setup` again after installing one. Until then, loans renew only with `shelf renew` or `shelf used`."

Hook statuses per harness:

| Status | Meaning |
|---|---|
| `hooks installed` | Added or replaced. |
| `hooks up to date` | Already as wanted. |
| `hooks removed` | Removed (`--no-hooks`). |
| `no shelf hooks` | `--no-hooks`, and there were none. |
| `skipped` | The settings file isn't a JSON object; shelf left it alone (the problem is printed after it). |

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"home":"/home/me/.shelf","library":"/home/me/.shelf/library","installed":["/home/me/.agents/skills/shelf/SKILL.md","/home/me/.claude/skills/shelf/SKILL.md"],"hooks":[{"harness":"claude-code","label":"Claude Code","file":"/home/me/.claude/settings.json","status":"unchanged","needsTrust":false},{"harness":"codex","label":"Codex","file":"/home/me/.codex/hooks.json","status":"unchanged","needsTrust":true}]}}
```

| Field | Meaning |
|---|---|
| `home`, `library` | The shelf home and library paths. |
| `installed` | Every path where the bundled skill is installed. |
| `hooks[].harness` | `claude-code` or `codex`. Harnesses that aren't installed are absent. |
| `hooks[].status` | `installed`, `unchanged`, `removed`, `absent` or `skipped`. |
| `hooks[].needsTrust` | `true` for Codex: trust the hooks once in `/hooks`. |
| `hooks[].problem` | Present when `skipped`: why. |

## Errors

| Code | When |
|---|---|
| `INVALID_ARGUMENT` | The existing `config.json` can't be read or is invalid. |

## Related

- [Installation](../installation.md), [Hooks](../hooks.md)
- [`shelf doctor`](doctor.md) checks and repairs what `setup` installs.
