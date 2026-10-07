# shelf sync

Reconciles this project with its loans: returns overdue skills that have no local edits, restores missing copies, and applies library updates to loans borrowed with `--follow`. The session-start hook runs the same sync.

<!-- generated:cli sync -->

```text
shelf sync
```

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## What it does

1. **Returns overdue loans** whose copies are unedited (`current`, `behind` or `missing`): deletes the copies, closes the loan (`expired` in the activity log). Overdue loans with local edits stay.
2. **Restores missing copies** of loans whose remaining copies are unedited, from a remaining copy, else the borrowed revision, else (on a machine that never stored that revision) the latest one.
3. **Updates `follow` loans** that are `behind` and unedited to the library's latest revision.

It also does what every project command does on open: registers a fresh clone and creates loans for lockfile entries this machine has none for. Run it after cloning a project whose skill copies aren't committed.

## Examples

```console
$ shelf sync
Restored: git-hygiene

$ shelf sync
Updated: api-design, pdf-tools

$ shelf sync
Everything is in sync.
```

Each kind of change gets its own line: `Returned overdue: …`, `Restored: …`, `Updated: …`. Warnings follow as `warning: …` lines.

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"project":{"id":"da6c4e70-e25d-4d10-a389-b6ed7360fa5a","name":"storefront","path":"/home/me/code/storefront"},"expired":[],"restored":[],"updated":[],"warnings":[]}}
```

`expired`, `restored` and `updated` list skill names; `warnings` are strings.

## Errors

| Code | When |
|---|---|
| `NOT_INITIALIZED` | Not inside a shelf project. |
| `CONFLICT` | The lockfile is invalid. |

## Related

- [`shelf sweep`](sweep.md) syncs every project; [`shelf status`](status.md) also returns overdue loans and reports.
- [Borrowing](../borrowing.md#sync)
