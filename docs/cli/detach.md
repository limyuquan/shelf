# shelf detach

Stops managing a borrowed skill in this project but leaves its files where they are. The copies become ordinary project files that shelf no longer tracks, renews or returns.

<!-- generated:cli detach -->

```text
shelf detach <skill>
```

| Argument | Description |
| --- | --- |
| `<skill>` | Skill name |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## What it does

Closes the loan, removes the skill from the lockfile and records `detached` in the activity log. Nothing on disk changes. Local edits, if any, stay.

Use it to keep a project-specific variant of a skill, or for an overdue loan with edits you don't want in the library. To publish the edits instead, use `shelf promote`.

Once detached, the directory is unmanaged: borrowing the same skill again fails with `CONFLICT` until you move or delete it (unless its files are identical to the library's latest revision, which shelf then takes over).

## Examples

```console
$ shelf detach pdf-tools
Detached pdf-tools; its files now belong to the project
```

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skill":"react-best-practices"}}
```

## Errors

| Code | When |
|---|---|
| `NOT_INITIALIZED` | Not inside a shelf project. |
| `NOT_BORROWED` | The project doesn't borrow the skill. |

## Related

- [`shelf return`](return.md), [`shelf promote`](promote.md)
