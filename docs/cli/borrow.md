# shelf borrow

Copies library skills into this project and records a loan for each, with a due date. Accepts several skill names, and `@<set>` for every skill in a set. Borrowing a skill that is already borrowed changes nothing.

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

## What it does

1. Expands `@set` arguments into their skills and checks every name before touching the project, so one bad name changes nothing.
2. For each skill not yet borrowed, copies its latest revision from the object store into every target directory of the project (`.agents/skills` and `.claude/skills` by default; see [`shelf targets`](targets.md)).
3. Records the loan: the revision, the targets, the policy, the mode, and a due date of `--days` or the skill's loan length from now.
4. Rewrites the lockfile.

| Option | Effect |
|---|---|
| `--days N` | Loan length in days. Default: the skill's loan length (`shelf loan-days`), else `loanDays` (30). At most `maxLoanDays` (90). |
| `--keep` | The loan never expires. Also applies to skills that are already borrowed. Agents keep only skills covering a direct dependency of the project. |
| `--follow` | Policy `follow`: `shelf sync`, `shelf sweep` and session starts apply library updates automatically. |
| `--link` | Mode `link`: one real copy in the first target, symlinks (junctions on Windows) in the others. Default: the config's `mode`. |

### Existing directories

shelf never writes into a skill directory it doesn't manage. If a target already holds a directory with the skill's name and different content, `borrow` fails with `CONFLICT` and nothing is written. Adopt the existing copy instead (`shelf adopt <path>`), or move it away. A leftover copy identical to the revision being borrowed (from an interrupted borrow) is taken over.

## Examples

```console
$ shelf borrow pdf-tools api-design
Borrowed pdf-tools (due 2026-11-06) → .agents/skills, .claude/skills
Borrowed api-design (due 2026-11-06) → .agents/skills, .claude/skills

$ shelf borrow @frontend
Borrowed playwright-testing (due 2026-11-06) → .agents/skills, .claude/skills
Borrowed react-best-practices (due 2026-11-06) → .agents/skills, .claude/skills

$ shelf borrow pdf-tools
pdf-tools is already borrowed (due 2026-12-06)
```

Kept loans print `kept, never expires` instead of the due date.

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skills":[{"skill":"pdf-tools","status":"borrowed","revision":"sha256:dca5f929e749b602869f964b944ab1c8567353094f413d0f53dabe7dfa015b67","dueAt":"2026-11-06T05:51:38.125Z","targets":[".agents/skills",".claude/skills"],"mode":"copy","kept":false}]}}
```

| Field | Meaning |
|---|---|
| `skills[].status` | `borrowed`, or `already-borrowed` (then the other fields describe the existing loan). |
| `skills[].revision` | The revision the project holds. |
| `skills[].dueAt` | The due date. |
| `skills[].targets` | Where the copies are. |
| `skills[].mode` | `copy` or `link`. |
| `skills[].kept` | Whether the loan never expires. |

## Errors

| Code | When |
|---|---|
| `NOT_INITIALIZED` | Not inside a shelf project (run `shelf init`). |
| `INVALID_ARGUMENT` | An invalid skill name; `--days` not a positive integer; a set with no skills. |
| `SKILL_NOT_FOUND` | A skill isn't in the library, or a set doesn't exist. |
| `LOAN_LIMIT` | `--days` is more than `maxLoanDays`. |
| `CONFLICT` | A target already has an unmanaged directory with the skill's name. |

```console
$ shelf borrow pdf-tools
error: No shelf project at /home/me/code/storefront
hint: Run `shelf init` in the project root
```

## Related

- [Borrowing](../borrowing.md)
- [`shelf return`](return.md), [`shelf keep`](keep.md), [`shelf catalog`](catalog.md), [`shelf set`](set.md)
