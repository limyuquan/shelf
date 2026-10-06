# shelf — guide for agents

shelf lends skills from the user's personal library (`~/.shelf/library`) to
projects. Each borrowed skill is copied into `.agents/skills/<name>` and
`.claude/skills/<name>`, tracked by content hash in `.agents/shelf.lock.json`,
and has a due date. Overdue skills are returned automatically so stale skills
do not linger.

## Session start

Run `shelf status --json`. If `data.initialized` is false, run `shelf init`.
Otherwise read `data.loans` and act on `data.actions` — each has a runnable
`command` and a `reason`.

## Loan states

`content` (project copy vs library):
- `current`  — matches the borrowed revision, which is the latest.
- `behind`   — the library has a newer revision. `shelf update <name>`.
- `modified` — the project copy was edited. `shelf promote <name>` to publish
  the edits to the library, `shelf detach <name>` to keep them unmanaged, or
  `shelf update <name> --force` to discard them.
- `diverged` — edited here and in the library. Review both before choosing.
- `missing`  — copies were deleted. `shelf sync` restores them.

`due`: `active`, `due-soon` (within 7 days by default), `overdue`.

## Choosing skills

- `shelf catalog <terms> --json` lists skills with descriptions and a token
  estimate. Borrow only what the project needs; every skill costs context.
- `shelf show <name>` prints the full skill before you borrow it.
- `shelf borrow <name...> [--days N] [--follow]`. `--follow` lets
  `shelf sync` apply library updates automatically.

## Due dates

- `shelf renew <name> [--days N] --reason "<why>"` extends from the due date.
- `shelf due <name> <+14d|-7d|+2w|2026-12-01>` moves it either way.
- Loans cannot extend past the configured limit (90 days by default).
- Renew skills you actually used; return the ones you did not. Give a reason:
  the user reviews it in the activity log.

## Changing skills everywhere

- `shelf diff <name>` shows local edits (or pending library changes).
- `shelf promote <name> --propagate` publishes this project's edits and updates
  every other project borrowing the skill. Copies with their own local edits
  are skipped, never overwritten.
- `shelf propagate <name> --dry-run` previews pushing the library's latest.
- `shelf log <name>` lists revisions and who borrows which.

## Existing skills

`shelf scan <dir>` finds skill copies not yet managed by shelf; `shelf adopt
<path>` imports one into the library and manages its project's copies.
Only adopt when the user asks — it changes the library.

## Rules

- Do not edit library files under `~/.shelf` unless the user asks you to
  change a skill everywhere.
- Do not delete skill copies by hand; use `shelf return`.
- Commands never prompt. They are safe to retry. With `--json`, output is one
  line: `{ "schemaVersion": 1, "ok": true, "data": … }` or
  `{ "ok": false, "error": { "code", "message", "hint" } }`.
