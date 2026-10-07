# shelf archive

Moves a library skill out of the library into `~/.shelf/archive/`, without deleting anything. Its revisions stay recorded, and moving the directory back restores it. Refused while any project borrows the skill.

<!-- generated:cli archive -->

```text
shelf archive <name>
```

| Argument | Description |
| --- | --- |
| `<name>` | Skill name |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## What it does

Moves `~/.shelf/library/<name>` to `~/.shelf/archive/<name>-<timestamp>/` (UTC, such as `commit-messages-2026-10-07T05-35-15`) and marks the skill archived. Archived skills disappear from `catalog`, `search`, sets and the dashboard. Their snapshots stay in `~/.shelf/objects/`.

To restore, move the directory back to `~/.shelf/library/<name>`. The next command picks it up with its history.

The archived skill keeps its name: `new`, `rename`, `duplicate` and `add` refuse to use it.

Project copies and lockfiles carry the skill's name, so archiving a borrowed skill is refused. Return it from every project first. Agents archive skills only when you ask.

## Examples

```console
$ shelf archive commit-messages
Archived commit-messages to /home/me/.shelf/archive/commit-messages-2026-10-07T05-35-15
Its revisions are kept. To restore it, move that directory back into the library.
```

```console
$ shelf archive api-design
error: api-design is borrowed by billing-api, storefront. Archiving it would orphan their copies and lockfiles.
hint: Return it from billing-api, storefront first (`shelf return api-design` in each project)
```

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skill":"demo-three","path":"/home/me/.shelf/archive/demo-three-2026-10-07T05-51-51"}}
```

`path` is where the directory went.

## Errors

| Code | When |
|---|---|
| `SKILL_NOT_FOUND` | No skill by that name in the library. |
| `CONFLICT` | A project borrows the skill. |

## Related

- [Writing skills](../writing-skills.md#archive)
- [`shelf rename`](rename.md), [Files](../files.md)
