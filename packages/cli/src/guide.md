# shelf — guide for agents

shelf lends skills from the user's personal library (`~/.shelf/library`) to
projects. Each borrowed skill is copied into `.agents/skills/<name>` and
`.claude/skills/<name>`, tracked by content hash in `.agents/shelf.lock.json`,
and has a due date. Using a skill renews it; skills that go unused until their
due date are returned automatically, so stale skills do not linger.

## Session start

In Claude Code and Codex, shelf's hooks sync the project when a session starts
and add a one-line `shelf: …` note only when something needs attention (a skill
due soon, local edits, library updates, skills just returned). No note means
nothing to do.

For details, or in harnesses without hooks, run `shelf status --json`. If
`data.initialized` is false, the project does not use shelf: leave it alone
unless the user asks you to start using shelf there. Otherwise read
`data.loans` and act on `data.actions` — each has a runnable `command` and a
`reason`.

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

- Using a borrowed skill (the Skill tool, reading its files, or the user
  invoking it) moves its due date to 30 days from now. The hooks record this;
  in harnesses without hooks, run `shelf used <name>` after using a skill.
- A `due-soon` skill has gone unused for a while. `shelf renew <name> [--days N]
  --reason "<why>"` keeps it if the project still needs it; otherwise
  `shelf return <name>`. Give a reason: the user reviews it in the activity log.
- `shelf due <name> <+14d|-7d|+2w|2026-12-01>` moves a due date either way.
- Loans cannot extend past the configured limit (90 days by default).

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
Only adopt when the user asks — it changes the library. Copies that differ from
the library are kept as local edits (`modified`), unless they match an earlier
revision or you pass `--unedited` (they are older versions, e.g. installed from
upstream at different times): those loans are `behind`. Adopt the newest copy
first.

## Skills from outside the library

`shelf add <source>` and `shelf pull <name>` fetch and audit; they change the
library only with `--yes`. You may run the review step, but importing from a
remote source with `--yes` is refused unless the user enabled it — show them
the review and the exact command to run. Never pass `--force` on high-severity
findings without the user's explicit approval. `shelf audit` scans library
skills.

If the library already has the skill (e.g. it was adopted), `shelf add
<source> --yes` only links it to the source, which you may do: the content is
unchanged until a `shelf pull`.

## Harness directories

`shelf targets` shows which skill directories this project uses and suggests
harnesses that need their own (e.g. Kiro). Change them only when asked.

## Rules

- Do not edit library files under `~/.shelf` unless the user asks you to
  change a skill everywhere.
- Do not delete skill copies by hand; use `shelf return`.
- Commands never prompt. They are safe to retry. With `--json`, output is one
  line: `{ "schemaVersion": 1, "ok": true, "data": … }` or
  `{ "ok": false, "error": { "code", "message", "hint" } }`.
