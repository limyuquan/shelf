# shelf renew

Extend a loan (from its due date, or from today if overdue).

## Usage

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
