# shelf keep

Keep borrowed skills: they never expire (--off to stop keeping).

## Usage

<!-- generated:cli keep -->

```text
shelf keep <skill>... [options]
```

| Argument | Description |
| --- | --- |
| `<skill>...` | One or more skill names |

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--off` | boolean |  | Stop keeping: the loan comes due again if unused |
| `--reason <reason>` | string |  | Why (recorded in the activity log), e.g. the dependency it covers |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->
