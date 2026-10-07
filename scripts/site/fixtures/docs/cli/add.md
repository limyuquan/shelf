# shelf add

Import skills from a git repository or directory (reviews first; --yes imports).

## Usage

<!-- generated:cli add -->

```text
shelf add <source> [options]
```

| Argument | Description |
| --- | --- |
| `<source>` | gh:owner/repo[/path][@ref], a git URL, or a local directory |

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--ref <ref>` | string |  | Branch, tag or commit |
| `--path <path>` | string |  | Skill directory inside the source |
| `--skill <skill>` | string |  | Skills to take when the source has several (comma-separated) |
| `--all` | boolean |  | Take every skill in the source |
| `--yes` | boolean |  | Import after review |
| `--force` | boolean |  | Import despite high-severity findings |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->
