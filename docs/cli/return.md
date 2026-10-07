# shelf return

Removes a borrowed skill from this project: deletes its copies in every target and closes the loan. Refuses when a copy has local edits, unless `--force`.

<!-- generated:cli return -->

```text
shelf return <skill> [options]
```

| Argument | Description |
| --- | --- |
| `<skill>` | Skill name |

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--force` | boolean |  | Discard local edits to the project copy |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## What it does

Deletes `<target>/<name>` for each of the loan's targets, closes the loan, removes the skill from the lockfile and records `returned` in the activity log. The library is untouched; borrow it again any time.

If a copy has local edits (`modified` or `diverged`), it refuses. Keep the edits with `shelf promote` (publish to the library) or `shelf detach` (keep them in the project, unmanaged), or discard them with `--force`.

Don't delete skill copies by hand: shelf would see them as `missing` and restore them.

## Examples

```console
$ shelf return pdf-tools
Returned pdf-tools
```

```console
$ shelf return pdf-tools
error: The project copy of "pdf-tools" has local edits
hint: Keep them with `shelf promote pdf-tools` or `shelf detach pdf-tools`, or discard them with --force
```

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skill":"release-notes"}}
```

## Errors

| Code | When |
|---|---|
| `NOT_INITIALIZED` | Not inside a shelf project. |
| `NOT_BORROWED` | The project doesn't borrow the skill. |
| `LOCAL_CHANGES` | A copy has local edits and `--force` wasn't given. |

## Related

- [`shelf detach`](detach.md), [`shelf promote`](promote.md), [`shelf borrow`](borrow.md)
