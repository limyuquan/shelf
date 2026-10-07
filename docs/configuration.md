# Configuration

shelf's config file, `~/.shelf/config.json`: where it lives, every key with its default, how to change it, and what happens when it is invalid. Project-specific settings live in the project's lockfile instead.

## The file

The config is `config.json` in the shelf home: `~/.shelf/config.json`, or `$SHELF_HOME/config.json` when `SHELF_HOME` is set. `shelf setup` creates it with every default:

```json
{
  "loanDays": 30,
  "maxLoanDays": 90,
  "dueSoonDays": 7,
  "allowAgentImports": false,
  "hooks": true,
  "mode": "copy",
  "targets": [
    ".agents/skills",
    ".claude/skills"
  ]
}
```

Edit it with any editor; there is no `shelf config` command. Every command reads it when it starts. `shelf ui` reads it once at startup, so restart the dashboard after editing it. Missing keys take their defaults, so a file with only the keys you change works too. Without a file, every default applies.

`shelf setup` only ever changes the `hooks` key in an existing file; everything else you set is kept.

## Keys

<!-- generated:config -->

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `loanDays` | integer | `30` | Loan length in days for `borrow`, and the default extension for `renew`. |
| `maxLoanDays` | integer | `90` | Upper bound on how far in the future a due date may be set, in days. |
| `dueSoonDays` | integer | `7` | Loans due within this many days are reported as `due-soon`. |
| `allowAgentImports` | boolean | `false` | Lets agents run `shelf add` / `shelf pull` from remote sources. Off by default: the library is the trust boundary, and only the user should widen it. |
| `hooks` | boolean | `true` | Install harness hooks (Claude Code, Codex) that renew loans when a skill is used and report loans needing attention at session start. Set by `shelf setup`. |
| `mode` | `"copy"` \| `"link"` | `"copy"` | `copy`: a copy per target. `link`: one copy, other targets symlink to it. |
| `targets` | string[] | `[".agents/skills",".claude/skills"]` | Project-relative directories that borrowed skills are written into. |

<!-- /generated -->

### loanDays

The default loan length, in days: how long a new loan lasts, and how far a use or a renewal moves the due date. A skill can override it with [`shelf loan-days`](cli/loan-days.md). Always capped at `maxLoanDays`.

### maxLoanDays

No command sets a due date more than this many days from now (`borrow --days`, `renew`, `due`, `loan-days` all fail with `LOAN_LIMIT` past it). Lowering it doesn't shorten existing loans, but skill loan lengths above it are capped from then on.

### dueSoonDays

A loan is `due-soon` when it is due within this many days. It then shows in `shelf status` next steps, the session-start note and the dashboard's Attention page. `0` turns the state off.

### allowAgentImports

When `false`, agents (actors starting with `agent:`) may review skills from git sources but not import them: `shelf add --yes` of a new skill and `shelf pull --yes` fail with `NOT_ALLOWED`. Set it to `true` only if you want agents to widen your library on their own. See [Importing skills](importing-skills.md#what-agents-may-do).

### hooks

Whether shelf's harness hooks should be installed. `shelf setup` sets it (`--no-hooks` writes `false`), and `shelf doctor` checks the hooks only when it is `true`. Editing it by hand doesn't install or remove hooks; run `shelf setup` or `shelf setup --no-hooks`.

### mode

`copy` gives every target its own copy of a borrowed skill. `link` keeps one copy in the first target and makes the others relative symlinks to it (junctions on Windows). Applies to new loans; `shelf borrow --link` chooses link mode for one loan. See [Harnesses](harnesses.md#link-mode).

### targets

The project-relative directories borrowed skills are written into, at least one. A project can override it with [`shelf targets`](cli/targets.md), which stores its own list in the lockfile. Changing this key doesn't move existing loans; `shelf targets --reset` in a project applies it there.

## Examples

Longer loans, warned about two weeks ahead:

```json
{ "loanDays": 60, "dueSoonDays": 14 }
```

One copy per project, also written for Kiro:

```json
{ "mode": "link", "targets": [".agents/skills", ".claude/skills", ".kiro/skills"] }
```

## Invalid config

A config that isn't valid JSON, or has a value of the wrong type, makes every command fail with `INVALID_ARGUMENT` (exit 2) until it is fixed:

```console
$ shelf status
error: Invalid config /home/me/.shelf/config.json: ✖ Invalid input: expected number, received string
  → at loanDays
```

Unknown keys are ignored.

## Settings that aren't in the config

| Setting | Where | Command |
|---|---|---|
| A skill's loan length | Database, per machine | `shelf loan-days` |
| A project's targets | Lockfile, shared with clones | `shelf targets` |
| A loan's policy, mode and keep | Database; mode and keep also in the lockfile | `shelf borrow --follow --link`, `shelf keep` |
| Sets | Database, per machine | `shelf set` |
| Where the shelf home is | `SHELF_HOME` | See [Environment](environment.md) |

## Related

- [Environment](environment.md), [Files](files.md), [Lockfile](lockfile.md)
