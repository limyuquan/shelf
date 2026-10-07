# shelf rename

Renames a library skill: its directory and the `name:` in its SKILL.md frontmatter, keeping its revisions, settings and activity. Refused while any project borrows the skill.

<!-- generated:cli rename -->

```text
shelf rename <from> <to>
```

| Argument | Description |
| --- | --- |
| `<from>` | Current name |
| `<to>` | New name |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## What it does

1. Checks the new name: valid, not used by another skill in the library, and not the name of an archived skill.
2. Moves `~/.shelf/library/<from>` to `~/.shelf/library/<to>`.
3. Rewrites only the frontmatter's `name:` value, keeping its quoting and any comment; every other byte of SKILL.md stays.
4. Renames the skill in the database, so its revisions, loan length, set memberships and activity stay attached. The changed SKILL.md is recorded as a new revision.

Project copies and lockfiles carry the skill's name, so renaming a borrowed skill would orphan them. Return it from every project first (`shelf log <name>` lists borrowers).

Agents rename skills only when you ask.

## Examples

```console
$ shelf rename commit-style commit-messages
Renamed commit-style to commit-messages at /home/me/.shelf/library/commit-messages
```

```console
$ shelf rename react-best-practices react-patterns
error: react-best-practices is borrowed by storefront. Renaming it would orphan their copies and lockfiles.
hint: Return it from storefront first (`shelf return react-best-practices` in each project)
```

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"from":"demo-skill","skill":"demo-two","path":"/home/me/.shelf/library/demo-two","revision":"sha256:63078f76416f777805bd21d45067c67bcda35e1eef8b35b35e89f791534af46a"}}
```

## Errors

| Code | When |
|---|---|
| `SKILL_NOT_FOUND` | No skill named `<from>` in the library. |
| `INVALID_ARGUMENT` | `<to>` is not a valid name, or is the same as `<from>`. |
| `SKILL_EXISTS` | `<to>` is taken by a library directory or an archived skill. |
| `CONFLICT` | A project borrows the skill. |
| `INVALID_SKILL` | `name: <from>` can't be found in the frontmatter (edit it by hand, then rename the directory). |

## Related

- [Writing skills](../writing-skills.md#rename)
- [`shelf duplicate`](duplicate.md), [`shelf archive`](archive.md)
