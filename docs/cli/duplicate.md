# shelf duplicate

Copies a library skill to a new name, as a new skill with its own history. Use it to start a variant of a skill without touching the original.

<!-- generated:cli duplicate -->
<!-- /generated -->

## What it does

Copies every file of the skill's current library copy to `~/.shelf/library/<to>`, changes the frontmatter `name:` to the new name, and records the result as the new skill's first revision. The original is unchanged; the copy shares none of its history, loans or loan length.

Agents duplicate skills only when you ask.

## Examples

```console
$ shelf duplicate git-hygiene commit-style
Copied git-hygiene to commit-style at /home/me/.shelf/library/commit-style
```

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"from":"demo-two","skill":"demo-three","path":"/home/me/.shelf/library/demo-three","revision":"sha256:7f46b2ff68884ba387ca360efe12cf2fb903672b6d27e0bc5323c006e0229701"}}
```

## Errors

| Code | When |
|---|---|
| `SKILL_NOT_FOUND` | No skill named `<from>` in the library. |
| `INVALID_ARGUMENT` | `<to>` is not a valid name. |
| `SKILL_EXISTS` | `<to>` is taken by a library directory or an archived skill. |
| `INVALID_SKILL` | `name: <from>` can't be found in the frontmatter. |

## Related

- [`shelf rename`](rename.md), [`shelf new`](new.md)
