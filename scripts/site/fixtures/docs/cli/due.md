# shelf due

Move a loan's due date: +14d, -7d, +2w or 2026-12-01.

## Usage

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
