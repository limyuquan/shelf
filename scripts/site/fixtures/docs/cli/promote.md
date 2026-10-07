# shelf promote

Publish this project's edits to a skill back to the library.

## Usage

<!-- generated:cli promote -->

```text
shelf promote <skill> [options]
```

| Argument | Description |
| --- | --- |
| `<skill>` | Skill name |

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--force` | boolean |  | Replace the library revision even if it changed since borrowing |
| `--propagate` | boolean |  | Then update every other project borrowing it (skips local edits) |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->
