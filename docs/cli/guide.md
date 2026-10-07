# shelf guide

Prints the full guide for agents: how shelf works, loan states, choosing skills, due dates, keeping, changing skills everywhere, existing skills, imports and the rules agents follow.

<!-- generated:cli guide -->
<!-- /generated -->

## What it does

Prints a static Markdown document built into the binary. It needs no shelf home, database or project, so it works anywhere and never fails. The bundled `shelf` skill points agents to it ("Full guide: `shelf guide`").

The guide covers:

- what shelf does with borrowed skills, and the session-start note;
- reading `shelf status --json` and acting on `data.actions`;
- the content states and due states;
- choosing skills: `catalog`, `search`, `show`, `suggest`, `borrow`, sets;
- due dates: renew on use, `renew` with a reason, `due`, the loan limit;
- the context budget and `insights`;
- kept skills, and keeping only for direct dependencies;
- changing skills everywhere: `diff`, `promote --propagate`, `propagate`, `log`, `restore`, `lint`;
- existing skills: `scan`, `adopt`, `--unedited`;
- skills from outside: `add`, `pull`, `audit`, and what agents may not import;
- harness directories (`targets`);
- the rules: don't edit library files unless asked, don't delete copies by hand, commands never prompt.

The [Agents](../agents.md) page explains the same rules for people.

## Examples

```sh
shelf guide
```

```console
$ shelf guide | head -8
# shelf — guide for agents

shelf lends skills from the user's personal library (`~/.shelf/library`) to
projects. Each borrowed skill is copied into `.agents/skills/<name>` and
`.claude/skills/<name>`, tracked by content hash in `.agents/shelf.lock.json`,
and has a due date. Using a skill renews it; skills that go unused until their
due date are returned automatically, so stale skills do not linger.
```

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"guide":"# shelf — guide for agents\n\nshelf lends skills from the user's personal library …"}}
```

`data.guide` is the whole Markdown text.

## Errors

None.

## Related

- [Agents](../agents.md)
- [`shelf status`](status.md)
