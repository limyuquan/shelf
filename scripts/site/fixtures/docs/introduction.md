# Introduction

shelf is a personal skill library for coding agents. You keep your skills in one place, borrow them into projects, and loans expire when nobody uses them.

![The shelf logo](images/logo.png)

## Why a library

- **Copy-pasted skills drift.** The same skill lives in ten repos at ten different versions.
- **Global skill folders load everywhere.** A skill in `~/.claude/skills` is loaded into every project, relevant or not.
- **Registries are a supply-chain risk.** Your own library is the trust boundary.

## How loans work

A project borrows one revision of a skill until a due date. Each time an agent uses the skill, the due date moves out again (see [Configuration](configuration.md#keys) for `loanDays`).

> [!NOTE]
> Overdue loans are returned at the next session start, `shelf status` or `shelf sync`, unless the project copy has local edits. shelf never deletes edits.

> [!TIP]
> Run `shelf sweep` from a daily cron job to return overdue loans in every project.

| State | Meaning |
|---|---|
| `current` | The project copy matches the revision it borrowed, which is the library's latest |
| `behind` | The library has a newer revision; run `shelf update` |
| `modified` | The project copy has local edits; `shelf promote` or `shelf detach` them |
| `diverged` | Both the project copy and the library changed since the loan |
| `missing` | The copies are gone from disk; `shelf sync` restores them |

## Next steps

Borrow your first skill with [`shelf borrow`](cli/borrow.md), or read the [README](../README.md) and the [CLI source](../packages/cli/src/) on GitHub.

```ts
import { borrow } from "@shelf/core";

// Services take a Context and return plain data.
const results = await borrow(ctx, ["pdf-tools"], { policy: "pinned" });
```
