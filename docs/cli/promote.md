# shelf promote

Publishes this project's edits to a borrowed skill back to the library as a new revision. With `--propagate`, it then updates every other project that borrows the skill, skipping copies with their own edits.

<!-- generated:cli promote -->
<!-- /generated -->

## What it does

1. Checks the loan is `modified` (or `diverged` with `--force`) and that every edited copy has the same content.
2. Validates the edited SKILL.md.
3. Replaces the library copy with the edited copy and records it as a new revision with source `promote`.
4. Rewrites every copy in this project from that revision, so the loan is `current` again.
5. With `--propagate`, runs [`shelf propagate`](propagate.md) for the skill.

`--force` replaces the library's revision even if the library changed since this project borrowed (`diverged`). The library's newer revision stays in the history, so `shelf restore` can bring it back.

Review the edits with `shelf diff <name>` first.

## Examples

```console
$ shelf promote pdf-tools
Promoted pdf-tools: library ddad27dd34 → d4deea4b55

$ shelf promote api-design --propagate
Promoted api-design: library e09cc9a0ed → d74c95b92c
api-design → d74c95b92c
  billing-api: updated
  storefront: already current
```

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skill":"api-design","previousRevision":"sha256:d74c95b92cffd891a2c5de8a17c11ae8ed067d403dd8993f5c24e94625d29904","revision":"sha256:94dfa1e44815a035ea8d774521be869e9e42594866dbaa7a037058fdf5410753","propagation":null}}
```

`propagation` is `null` without `--propagate`, otherwise the [`shelf propagate` result](propagate.md#json-output).

## Errors

| Code | When |
|---|---|
| `NOT_INITIALIZED` | Not inside a shelf project. |
| `NOT_BORROWED` | The project doesn't borrow the skill. |
| `INVALID_ARGUMENT` | The copy has no local edits (`current` or `behind`). |
| `CONFLICT` | Copies are missing (run `shelf sync`); the library changed since borrowing (`--force` to replace it); or the copies in different targets were edited differently (make them identical). |
| `INVALID_SKILL` | The edited SKILL.md isn't a valid skill. |

```console
$ shelf promote api-design --json
{"schemaVersion":1,"ok":false,"error":{"code":"INVALID_ARGUMENT","message":"The project copy of \"api-design\" has no local edits to promote","hint":null}}
```

## Related

- [Keeping skills current](../keeping-skills-current.md#promote-a-projects-edits)
- [`shelf diff`](diff.md), [`shelf detach`](detach.md), [`shelf update --force`](update.md)
