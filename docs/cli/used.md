# shelf used

Records that borrowed skills were used in this project, which renews their loans. The hooks do this automatically in Claude Code and Codex; in other harnesses, agents run it after using a skill.

<!-- generated:cli used -->
<!-- /generated -->

## What it does

For each skill, moves the due date to the skill's loan length from now (if that is later than the current due date) and records the time as its last use. This is exactly what the `skill-use` hook does.

A use within an hour of the last recorded one is not written again (`status: "recent"`). The activity log gets at most one `used` entry per skill per day. Kept loans record uses too, so insights show what the project actually uses.

## Examples

```console
$ shelf used pdf-tools
pdf-tools: in use, due 2026-11-06
```

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skills":[{"skill":"release-notes","status":"recorded","dueAt":"2026-12-13T05:51:38.699Z"},{"skill":"react-best-practices","status":"recorded","dueAt":"2026-11-06T05:51:50.412Z"}]}}
```

`status` is `recorded`, or `recent` when a use was already recorded within the hour (nothing changed).

## Errors

| Code | When |
|---|---|
| `NOT_INITIALIZED` | Not inside a shelf project. |
| `NOT_BORROWED` | A named skill isn't borrowed by the project. Nothing is recorded. |

## Related

- [Hooks](../hooks.md#harnesses-without-hooks)
- [`shelf renew`](renew.md)
