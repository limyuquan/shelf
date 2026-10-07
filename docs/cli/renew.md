# shelf renew

Renews a loan: the new due date is the skill's loan length (or `--days`) from today, unless the loan is already due later. Give a `--reason`: it is recorded in the activity log.

<!-- generated:cli renew -->

```text
shelf renew <skill> [options]
```

| Argument | Description |
| --- | --- |
| `<skill>` | Skill name |

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--days <days>` | string | the skill's loan length, else config loanDays | Days from today |
| `--reason <reason>` | string |  | Why, recorded in the activity log |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## What it does

New due date = the later of the current due date and now plus `--days` (default: the skill's loan length, else `loanDays`), the same rule as a use. Renewing never moves a due date earlier, and renewing twice doesn't add up: it counts from today, not from the due date. The result can't be more than `maxLoanDays` from now.

With [hooks](../hooks.md) installed, loans renew themselves when used, so `renew` is for skills the project still needs but hasn't used lately: when `shelf status` lists a loan as `due-soon`, renew it or return it. Renewing a kept loan changes its stored due date, which only matters if it stops being kept.

## Examples

```console
$ shelf renew api-design --reason "still designing the orders API"
api-design is now due 2026-11-06
```

```console
$ shelf renew api-design --days 200
error: Due date 2027-06-24T05:34:17.582Z is beyond the 90-day loan limit
hint: The latest allowed due date is 2027-01-05
```

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skill":"release-notes","previousDueAt":"2026-10-17T06:29:25.107Z","dueAt":"2026-11-06T06:29:25.455Z"}}
```

## Errors

| Code | When |
|---|---|
| `NOT_INITIALIZED` | Not inside a shelf project. |
| `NOT_BORROWED` | The project doesn't borrow the skill. |
| `INVALID_ARGUMENT` | `--days` isn't a positive integer. |
| `LOAN_LIMIT` | The new due date would be more than `maxLoanDays` from now. |

## Related

- [`shelf due`](due.md) moves a due date either way; [`shelf used`](used.md) records a use; [`shelf keep`](keep.md)
- [Borrowing](../borrowing.md#renew)
