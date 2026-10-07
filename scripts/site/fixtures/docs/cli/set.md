# shelf set

Group library skills into sets, borrowed together with `shelf borrow @<set>`.

## Usage

<!-- generated:cli set -->

```text
shelf set <command>
```

| Command | Description |
| --- | --- |
| `shelf set list` | List your skill sets |
| `shelf set save` | Create a set, or replace its skills (accepts @set to extend another set) |
| `shelf set delete` | Delete a set (borrowed skills and loans are unaffected) |

<!-- /generated -->

## shelf set list

<!-- generated:cli set list -->

```text
shelf set list
```

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## shelf set save

<!-- generated:cli set save -->

```text
shelf set save <name> <skill>... [options]
```

| Argument | Description |
| --- | --- |
| `<name>` | Set name, e.g. frontend |
| `<skill>...` | One or more skill names |

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--description <description>`, `-d` | string |  | What the set is for |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## shelf set delete

<!-- generated:cli set delete -->

```text
shelf set delete <name>
```

| Argument | Description |
| --- | --- |
| `<name>` | Set name |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->
