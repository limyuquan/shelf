# shelf status

Shows this project's loans, their content and due states, and the next steps to take. It also returns overdue loans that have no local edits, so it is the one call an agent needs at the start of a task.

<!-- generated:cli status -->

```text
shelf status
```

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## What it does

1. Opens the project: registers it if this machine hasn't seen it (a fresh clone), follows it if its directory moved, and creates loans for lockfile entries this machine has no loan for.
2. Returns every overdue loan whose copies have no local edits (deletes the copies, closes the loan).
3. Reports every remaining loan and derives next steps.

Outside a project it reports `initialized: false` and suggests nothing to agents. Leave such projects alone unless the user asks to start using shelf there.

## Examples

```console
$ shelf status
docs-site  /home/me/code/docs-site

SKILL          CONTENT   DUE                     USED     POLICY  REVISION
pdf-tools      modified  2026-10-03  4d overdue  34d ago  pinned  15c6167210
release-notes  current   2026-11-06  30d left    today    pinned  0b01b7e535

Next steps:
  shelf promote pdf-tools
      pdf-tools has local edits. Promote them to the library, keep them unmanaged with `shelf detach pdf-tools`, or discard them with `shelf update pdf-tools --force`
  shelf detach pdf-tools
      pdf-tools is overdue but was not returned because it has local edits. Promote or detach it
```

| Column | Meaning |
|---|---|
| SKILL | The skill name. |
| CONTENT | `current`, `behind`, `modified`, `diverged` or `missing` (see [Concepts](../concepts.md#content-states)). |
| DUE | The due date and days left (`30d left`, `due today`, `4d overdue`), or `kept`. |
| USED | Last recorded use in this project: `today`, `27d ago` or `never`. |
| POLICY | `pinned` or `follow`. |
| REVISION | The first 10 hex characters of the revision the project holds. |

When it returned overdue loans, it says so:

```console
$ shelf status
storefront  /home/me/code/storefront

SKILL       CONTENT  DUE                   USED   POLICY  REVISION
api-design  current  2026-12-08  63d left  never  pinned  e09cc9a0ed

Returned overdue: pdf-tools
```

Outside a project:

```console
$ shelf status
/home/me/code/storefront does not use shelf yet. Run `shelf init` to start.
```

With no loans it prints ``No skills borrowed. Find some with `shelf catalog`.`` Warnings (invalid library skills, lockfile entries for skills this machine's library doesn't have) follow as `warning: …` lines.

## Next steps

| Loan | Command | Reason given |
|---|---|---|
| `missing` | `shelf sync` | Copies are missing; sync restores them. |
| `diverged` | `shelf show <name>` | Edited here and in the library: review, then `promote --force` or `update --force`. |
| `modified` | `shelf promote <name>` | Local edits: promote, detach, or `update --force`. |
| `behind`, pinned | `shelf update <name>` | The library has a newer revision. |
| `behind`, follow | `shelf sync` | The library has a newer revision. |
| overdue, unedited | `shelf sync` | Overdue; sync returns it. |
| overdue, edited | `shelf detach <name>` | Not returned because of local edits: promote or detach. |
| `due-soon` | `shelf renew <name> --reason "<why>"` | Unused and due in N days: renew, or `shelf return <name>`. |

Actions are deduplicated by command (several `behind` follow loans give one `shelf sync`). Commands are runnable as-is except the `<why>` placeholder.

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"initialized":true,"project":{"id":"4a0c83eb-468d-4cbb-a855-aa9865ca78fb","name":"mobile-app","path":"/home/me/code/mobile-app"},"loans":[{"skill":"react-best-practices","content":"behind","due":"active","dueAt":"2026-11-06T05:51:38.410Z","daysLeft":30,"lastUsedAt":null,"kept":false,"loanDays":30,"policy":"pinned","revision":"sha256:b1ee5d63864a272cee0f8565dd80dfdb80ef4a14c37a8a6b129efdb350a7a348","latestRevision":"sha256:3a1a31ace69218263c958abae2eb5b6e68958d495a00a089b5f9efb743a7b182","targets":[".agents/skills",".claude/skills"]}],"expired":[],"actions":[{"command":"shelf update react-best-practices","reason":"The library has a newer revision of react-best-practices"}],"warnings":[]}}
```

Outside a project:

```json
{"schemaVersion":1,"ok":true,"data":{"initialized":false,"root":"/home/me/code/storefront","actions":[]}}
```

| Field | Meaning |
|---|---|
| `initialized` | `false` outside a shelf project; then only `root` and `actions` (always empty) follow. |
| `project` | `id`, `name`, `path`. |
| `loans[].skill` | Skill name. |
| `loans[].content` | `current`, `behind`, `modified`, `diverged` or `missing`. |
| `loans[].due` | `active`, `due-soon` or `overdue`. Always `active` when kept. |
| `loans[].dueAt` | The due date. |
| `loans[].daysLeft` | Whole days until the due date, rounded up; negative when overdue. |
| `loans[].lastUsedAt` | Last recorded use, or `null`. |
| `loans[].kept` | Whether the loan never expires. |
| `loans[].loanDays` | The skill's loan length: how far a use or renewal moves the due date. |
| `loans[].policy` | `pinned` or `follow`. |
| `loans[].revision` | The revision the project holds. |
| `loans[].latestRevision` | The library's latest revision. |
| `loans[].targets` | Directories the skill is copied into. |
| `expired` | Skills this call returned. |
| `actions[]` | `{ command, reason }`, most urgent first. |
| `warnings` | Strings. |

## Errors

| Code | When |
|---|---|
| `CONFLICT` | The lockfile isn't valid JSON or doesn't match the schema. |
| `INVALID_ARGUMENT` | The config file is invalid. |

## Related

- [`shelf sync`](sync.md) does the same reconciliation without the report.
- [`shelf projects`](projects.md) gives counts for every project without changing anything.
- [Agents](../agents.md#status-and-actions)
