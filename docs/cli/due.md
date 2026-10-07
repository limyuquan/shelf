# shelf due

Moves a loan's due date, later or earlier: by a relative shift such as `+14d`, `-7d` or `+2w`, or to a date such as `2026-12-01`.

<!-- generated:cli due -->

```text
shelf due <skill> <when> [options]
```

| Argument | Description |
| --- | --- |
| `<skill>` | Skill name |
| `<when>` | Shift or absolute date |

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--reason <reason>` | string |  | Why, recorded in the activity log |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## What it does

| Form | New due date |
|---|---|
| `+Nd`, `-Nd` | The current due date shifted by N days. |
| `+Nw`, `-Nw` | The current due date shifted by N weeks. |
| `YYYY-MM-DD` | The end of that day, 23:59:59.999 UTC. |

The new date can't be more than `maxLoanDays` from now, but it can be in the past: the loan is then overdue, and the next `shelf status` or `shelf sync` returns it (unless it has local edits). `--reason` is recorded in the activity log.

Negative shifts such as `-7d` are read as the date argument, not as an option, so they need no `--` (though `shelf due api-design -- -7d` works too).

## Examples

```console
$ shelf due api-design +14d
api-design is now due 2026-12-20

$ shelf due api-design 2026-12-01
api-design is now due 2026-12-01

$ shelf due api-design -7d
api-design is now due 2026-11-24
```

```console
$ shelf due api-design tomorrow
error: Invalid due date "tomorrow"
hint: Use a relative shift like +14d, -7d, +2w or a date like 2026-12-01
```

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skill":"release-notes","previousDueAt":"2026-12-06T05:51:38.699Z","dueAt":"2026-12-13T05:51:38.699Z"}}
```

## Errors

| Code | When |
|---|---|
| `NOT_INITIALIZED` | Not inside a shelf project. |
| `NOT_BORROWED` | The project doesn't borrow the skill. |
| `INVALID_ARGUMENT` | The expression isn't one of the forms above, or is missing. |
| `LOAN_LIMIT` | The new date is more than `maxLoanDays` from now. |

## Related

- [`shelf renew`](renew.md), [`shelf keep`](keep.md)
- [Borrowing](../borrowing.md#move-a-due-date)
