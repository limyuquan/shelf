# shelf borrow

Copy library skills into the current project with a due date. Each skill gets its own loan, lockfile entry and copies in every target directory.

```console
$ shelf borrow pdf-tools api-design
Borrowed pdf-tools (due 2026-11-06) → .agents/skills, .claude/skills
Borrowed api-design (due 2026-11-06) → .agents/skills, .claude/skills
```

## Usage

<!-- generated:cli borrow -->

```text
shelf borrow <skill>... [options]
```

| Argument | Description |
| --- | --- |
| `<skill>...` | One or more skill names, or @&lt;set&gt; for every skill in a set |

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--days <days>` | string | the skill's loan length, else config loanDays | Loan length in days |
| `--keep` | boolean |  | Never expire: for skills covering a direct dependency of the project (kept skills load in every session) |
| `--follow` | boolean |  | Let `shelf sync` apply library updates automatically |
| `--link` | boolean |  | One copy per project; other harness directories symlink to it |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## Examples

Borrow every skill in a set:

```sh
shelf borrow @frontend
```

Keep a skill that covers a direct dependency of the project. Kept loans never expire:

```sh
shelf borrow convex-best-practices --keep
```

Borrow for two weeks, and let `shelf sync` apply library updates:

```console
$ shelf borrow playwright-testing --days 14 --follow
Borrowed playwright-testing (due 2026-10-21) → .agents/skills, .claude/skills
```

> [!WARNING]
> If a target directory already holds a copy of the skill that shelf does not manage, `borrow` stops with `CONFLICT` rather than overwrite it. Adopt the copy with [`shelf adopt`](adopt.md) first.

## See also

- [`shelf renew`](renew.md) extends a loan.
- [`shelf return`](return.md) removes the skill from the project.
- [How loans work](../introduction.md#how-loans-work)
