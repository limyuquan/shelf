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
| 1 | `INTERNAL` error; `shelf lint` found errors; or a usage error without `--json`. |
| 2 | `INVALID_ARGUMENT`, `INVALID_SKILL`; or a usage error with `--json`. |
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
- **Negative due shifts.** Arguments starting with `-` are read as options. Put `--` before them: `shelf due api-design -- -7d`.
- **Concurrency.** Several shelf processes can run at once, in the same project or not. Writes are serialised on the database and the lockfile is rewritten under the same lock.

## Commands

<!-- generated:cli-index -->
<!-- /generated -->
