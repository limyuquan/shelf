# shelf keep

Keeps borrowed skills so their loans never expire, or stops keeping them with `--off`. Keeping is written to the lockfile, so every clone of the project keeps the same skills. Keep only skills the project is built on.

<!-- generated:cli keep -->

```text
shelf keep <skill>... [options]
```

| Argument | Description |
| --- | --- |
| `<skill>...` | One or more skill names |

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--off` | boolean |  | Stop keeping: the loan comes due again if unused |
| `--reason <reason>` | string |  | Why (recorded in the activity log), e.g. the dependency it covers |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## What it does

A kept loan's due state is always `active`: nothing expires it, `shelf status` shows `kept` in the due column, and the dashboard's Attention page never lists it for its due date. Content states still apply, and uses are still recorded.

The lockfile entry gets `"keep": true`. When another machine (or a teammate's clone) opens the project, its loan is kept too. Accepts several names and `@set`.

With `--off`, the loan comes due again if unused. Its due date becomes at least one loan period from now, so a date that passed while it was kept doesn't expire it at once.

### When to keep

Kept skills load their description into every session from then on. Keep a skill only when it covers a direct dependency of the project: the framework, database or platform it is built on (Convex skills in a project whose `package.json` depends on `convex`). Don't keep skills the project merely touched, or "just in case": an ordinary loan renews itself whenever it is used. Agents follow this rule and name the dependency in `--reason`.

## Examples

```console
$ shelf keep api-design --reason "the project is an HTTP API"
api-design is now kept; it never expires

$ shelf keep api-design --off
Stopped keeping api-design; due 2026-12-01 unless used
```

Running it on a loan that already is (or isn't) kept says `was already kept` or `was not kept`.

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skills":[{"skill":"release-notes","kept":true,"changed":true,"dueAt":"2026-12-13T05:51:38.699Z"}]}}
```

| Field | Meaning |
|---|---|
| `kept` | Whether the loan is kept now. |
| `changed` | `false` when it already was (or wasn't) kept. |
| `dueAt` | The stored due date (it only matters once the loan stops being kept). |

## Errors

| Code | When |
|---|---|
| `NOT_INITIALIZED` | Not inside a shelf project. |
| `NOT_BORROWED` | A skill isn't borrowed (the hint suggests `shelf borrow <name> --keep`). |
| `SKILL_NOT_FOUND` | An `@set` doesn't exist. |

## Related

- [Context budget: when to keep](../context-budget.md#when-to-keep)
- [`shelf borrow --keep`](borrow.md), [Lockfile](../lockfile.md)
