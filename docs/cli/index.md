# CLI reference

The `shelf` command line: global flags, the JSON envelope, output conventions, exit codes, how arguments are parsed, and every command with a link to its page.

## Usage

```sh
shelf <command> [arguments] [options]
shelf <command> --help
shelf --version
```

Run shelf from anywhere inside a project for commands that act on "this project": shelf finds the project root by walking up to the nearest `.agents/shelf.lock.json`, else the nearest git root, else the working directory. Library commands work from anywhere.

## Global options

Every command except `guide`, `ui` and `hook` accepts these:

| Option | Effect |
|---|---|
| `--json` | Print one line: a JSON envelope `{ schemaVersion, ok, data \| error }`. |
| `--actor <name>` | Who is acting, recorded in the activity log. Default: auto-detected (see [Environment](../environment.md#actor-detection)). |
| `--help`, `-h` | Print the command's usage, arguments and options. |

`shelf --version` prints the version (`0.4.0`). `shelf guide` and `shelf ui` accept `--json` but not `--actor`.

## The JSON envelope

With `--json`, the command prints exactly one line on stdout, whether it succeeds or fails:

```json
{"schemaVersion":1,"ok":true,"data":{"skill":"release-notes","previousDueAt":"2026-11-06T05:51:38.699Z","dueAt":"2026-12-06T05:51:38.699Z"}}
```

```json
{"schemaVersion":1,"ok":false,"error":{"code":"LOAN_LIMIT","message":"Due date 2027-06-24T05:34:17.582Z is beyond the 90-day loan limit","hint":"The latest allowed due date is 2027-01-05"}}
```

| Field | Type | Meaning |
|---|---|---|
| `schemaVersion` | number | `1`. Bumped only on a breaking change to the envelope or any command's `data`. |
| `ok` | boolean | Whether the command succeeded. |
| `data` | object | The result, when `ok` is `true`. Its shape is documented on each command's page. |
| `error.code` | string | A stable error code, when `ok` is `false`. See [Errors](../errors.md). |
| `error.message` | string | What went wrong, in words. |
| `error.hint` | string or null | What to do about it, often an exact command. |

Dates in `data` are ISO 8601 strings in UTC. Revisions are full hashes (`sha256:` plus 64 hex characters). Paths are absolute.

With `--json`, usage errors (an unknown command, a missing argument) are envelopes too, with code `INVALID_ARGUMENT`:

```json
{"schemaVersion":1,"ok":false,"error":{"code":"INVALID_ARGUMENT","message":"Missing required positional argument: SKILL","hint":"Run `shelf --help` or `shelf <command> --help` for usage"}}
```

## Human output

Without `--json`, results go to stdout as plain text: tables with two-space columns, short hashes (10 hex characters), dates as `YYYY-MM-DD`. Errors go to stderr as `error: <message>` and `hint: <hint>`. An unexpected (internal) error also prints its stack trace.

Text output is for people and may change between versions. Scripts and agents should use `--json`.

## Exit codes

| Exit | Meaning |
|---|---|
| 0 | Success. |
| 1 | `INTERNAL` error, or `shelf lint` found errors. |
| 2 | `INVALID_ARGUMENT`, `INVALID_SKILL`, or a usage error (unknown command, missing argument). |
| 3 | `NOT_INITIALIZED` |
| 4 | `SKILL_NOT_FOUND`, `NOT_BORROWED` |
| 5 | `SKILL_EXISTS`, `CONFLICT` |
| 6 | `LOCAL_CHANGES` |
| 7 | `LOAN_LIMIT` |
| 8 | `NOT_ALLOWED` |

`shelf hook` always exits 0. See [Errors](../errors.md) for every code.

## Conventions

- **Never prompts.** Every command runs to completion without input, so agents and scripts can run it.
- **Safe to retry.** Borrowing a borrowed skill, keeping a kept one, `init` in an initialized project and `setup` are all no-ops the second time.
- **Refuses to lose work.** Anything that would discard local edits needs `--force`; importing needs `--yes`.
- **Several names.** `borrow`, `keep`, `used`, `update`, `lint`, `audit` and `adopt` accept several names in one call.
- **Comma-separated lists.** Options that take lists (`--skill`, `--project`, `--add`, `--remove`) split on commas.
- **Negative due shifts.** Arguments starting with `-` are read as options, except negative shifts for `shelf due`: `shelf due api-design -7d` needs no `--`.
- **Concurrency.** Several shelf processes can run at once, in the same project or not. Writes are serialised on the database and the lockfile is rewritten under the same lock.

## Commands

<!-- generated:cli-index -->

### Getting started

| Command | Description |
| --- | --- |
| [`shelf setup`](setup.md) | Create the shelf home, install the shelf skill and the hooks that renew skills on use (safe to re-run) |
| [`shelf init`](init.md) | Register the current project with shelf (creates .agents/shelf.lock.json) |
| [`shelf status`](status.md) | Show this project's loans and suggested next steps (returns overdue skills) |
| [`shelf guide`](guide.md) | Print the full guide for agents |

### Library

| Command | Description |
| --- | --- |
| [`shelf new`](new.md) | Create a skill in your library |
| [`shelf catalog`](catalog.md) | List library skills, optionally filtered by search terms |
| [`shelf search`](search.md) | Find library skills by what they say: names, descriptions, SKILL.md and references |
| [`shelf show`](show.md) | Print a library skill's SKILL.md and file list |
| [`shelf log`](log.md) | Show a skill's revisions and which projects borrow each |
| [`shelf diff`](diff.md) | Diff two versions of a skill: borrowed, library, project, or a revision |
| [`shelf propagate`](propagate.md) | Push the library's latest revision of a skill to every borrowing project |
| [`shelf restore`](restore.md) | Make an earlier revision of a skill the library's latest again |
| [`shelf loan-days`](loan-days.md) | Show or set a skill's loan length (how long loans and renewals last) |
| [`shelf set`](set.md) | Group library skills into sets, borrowed together with `shelf borrow @<set>` |
| [`shelf set list`](set.md) | List your skill sets |
| [`shelf set save`](set.md) | Create a set, or replace its skills (accepts @set to extend another set) |
| [`shelf set delete`](set.md) | Delete a set (borrowed skills and loans are unaffected) |
| [`shelf rename`](rename.md) | Rename a library skill (its directory and frontmatter name), keeping its history |
| [`shelf duplicate`](duplicate.md) | Copy a library skill to a new name, as a new skill with its own history |
| [`shelf archive`](archive.md) | Move a library skill to the archive (nothing is deleted) |
| [`shelf lint`](lint.md) | Check skills' SKILL.md against the Agent Skills format (exits 1 on errors) |

### Loans in the current project

| Command | Description |
| --- | --- |
| [`shelf insights`](insights.md) | Context each project loads at session start, and which skills agents actually use (30 days) |
| [`shelf suggest`](suggest.md) | Suggest library skills that match what this project uses (its dependencies, files) |
| [`shelf borrow`](borrow.md) | Copy library skills into this project with a due date |
| [`shelf renew`](renew.md) | Renew a loan: due the loan length (or --days) from today, unless already due later |
| [`shelf used`](used.md) | Record that borrowed skills were used, which renews them (hooks do this for you) |
| [`shelf due`](due.md) | Move a loan's due date: +14d, -7d, +2w or 2026-12-01 |
| [`shelf keep`](keep.md) | Keep borrowed skills: they never expire (--off to stop keeping) |
| [`shelf return`](return.md) | Remove a borrowed skill from this project |
| [`shelf update`](update.md) | Update borrowed skills to the library's latest revision (all if none named) |
| [`shelf promote`](promote.md) | Publish this project's edits to a skill back to the library |
| [`shelf detach`](detach.md) | Stop managing a skill; its files stay in the project |
| [`shelf sync`](sync.md) | Return overdue skills, restore missing copies, apply updates to --follow loans |
| [`shelf targets`](targets.md) | Show or change which harness skill directories this project uses |

### Bringing skills in: existing copies, or from outside

| Command | Description |
| --- | --- |
| [`shelf scan`](scan.md) | Find skill copies under a directory and group duplicates and drifted versions |
| [`shelf adopt`](adopt.md) | Import existing skill directories into the library and manage them as loans |
| [`shelf add`](add.md) | Import skills from a git repository or directory (reviews first; --yes imports) |
| [`shelf pull`](pull.md) | Update an imported skill from its source (shows diff and audit; --yes applies) |
| [`shelf audit`](audit.md) | Scan library skills for risky content (all, or the named ones) |

### Across projects

| Command | Description |
| --- | --- |
| [`shelf projects`](projects.md) | List every project using shelf, with loan counts |
| [`shelf sweep`](sweep.md) | Run `sync` in every registered project (e.g. from a daily cron job) |
| [`shelf doctor`](doctor.md) | Check shelf's state for problems; --fix repairs what it safely can |
| [`shelf ui`](ui.md) | Open the local dashboard (projects, loans, library editor) |

### Called by harness hooks, not people

| Command | Description |
| --- | --- |
| [`shelf hook`](hook.md) | Run a harness hook (installed by `shelf setup`; reads the payload on stdin) |

<!-- /generated -->
