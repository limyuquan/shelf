# shelf restore

Makes an earlier revision of a skill the library's latest again, by copying its snapshot back over the library copy. Nothing is deleted, and projects keep the revision they have until they update.

<!-- generated:cli restore -->
<!-- /generated -->

## What it does

1. Records any unrecorded edits to the library copy as a revision first, so they stay in the history.
2. Replaces `~/.shelf/library/<name>/` with the snapshot of the given revision.
3. Makes that revision the skill's latest. `shelf log` then marks the old entry with `*`; the activity log records the restore.

The revision is a full hash or a unique prefix of at least 6 hex characters; see [`shelf log`](log.md). Restoring the revision that is already the latest changes nothing.

Borrowing projects become `behind` (or stay on the restored revision if they hold it). Push it to them with `shelf propagate <name>`.

Agents restore only when you ask.

## Examples

```console
$ shelf restore pdf-tools ddad27dd34
Restored pdf-tools to rev ddad27dd34 (was d4deea4b55).
Projects that borrow it keep their revision until they update:
  shelf propagate pdf-tools
```

When it is already the latest: `pdf-tools is already at rev ddad27dd34.`

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skill":"pdf-tools","revision":"sha256:ddad27dd34082032a0f9564e301c57903aeb482c1f97b56b07844301a222bc36","previousRevision":"sha256:dca5f929e749b602869f964b944ab1c8567353094f413d0f53dabe7dfa015b67","restored":true}}
```

`restored` is `false` when the revision already was the latest (then `revision` equals `previousRevision`).

## Errors

| Code | When |
|---|---|
| `SKILL_NOT_FOUND` | No skill by that name in the library. |
| `INVALID_ARGUMENT` | The revision is too short, ambiguous or unknown. |
| `CONFLICT` | The revision's snapshot is missing from the object store. |
| `INVALID_SKILL` | The snapshot's SKILL.md is not a valid skill. |

## Related

- [`shelf log`](log.md), [`shelf show --revision`](show.md), [`shelf propagate`](propagate.md)
- The dashboard's revision page has **Restore this revision**.
