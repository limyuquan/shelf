# shelf update

Updates borrowed skills in this project to the library's latest revision: the named ones, or every loan when none are named. Copies with local edits are skipped, or refused when named, unless `--force`.

<!-- generated:cli update -->

```text
shelf update [<skill>...] [options]
```

| Argument | Description |
| --- | --- |
| `<skill>...` (optional) | Skill names. Default: all |

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--force` | boolean |  | Discard local edits to the project copies |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## What it does

For each loan:

| Content | Result |
|---|---|
| `current` | Nothing to do (`already at`). |
| `behind`, `missing` | Copies rewritten from the latest revision (`updated to`). |
| `modified`, `diverged`, named | Refused with `LOCAL_CHANGES`, unless `--force`. |
| `modified`, `diverged`, not named | Skipped (`skipped (local edits) at`), unless `--force`. |

With `--force`, local edits are discarded and the copies get the latest revision.

To update every project at once from the library side, use [`shelf propagate`](propagate.md). Loans borrowed with `--follow` are updated by `shelf sync`.

## Examples

```console
$ shelf update api-design
api-design: updated to e09cc9a0ed

$ shelf update
api-design: already at e09cc9a0ed
pdf-tools: updated to ddad27dd34
```

```console
$ shelf update pdf-tools
error: The project copy of "pdf-tools" has local edits
hint: Keep them with `shelf promote pdf-tools`, or discard them with --force
```

With no loans: `Nothing borrowed.`

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skills":[{"skill":"react-best-practices","status":"updated","revision":"sha256:3a1a31ace69218263c958abae2eb5b6e68958d495a00a089b5f9efb743a7b182"},{"skill":"release-notes","status":"current","revision":"sha256:3547e8b373aeda43d2e36619c153c81d423115a179bd59ad1a5a5a1837c34fbd"}]}}
```

`status` is `updated`, `current` or `skipped-local-changes`. `revision` is the revision the loan holds afterwards.

## Errors

| Code | When |
|---|---|
| `NOT_INITIALIZED` | Not inside a shelf project. |
| `NOT_BORROWED` | A named skill isn't borrowed. |
| `LOCAL_CHANGES` | A named skill's copy has local edits and `--force` wasn't given. |

## Related

- [Keeping skills current](../keeping-skills-current.md)
- [`shelf propagate`](propagate.md), [`shelf promote`](promote.md), [`shelf diff`](diff.md)
