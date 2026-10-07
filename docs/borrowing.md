# Borrowing

How to borrow skills into a project and manage the loans afterwards: renewing, recording uses, moving due dates, keeping, returning, detaching and following library updates.

All commands on this page act on the project that contains the working directory. Run `shelf init` in a project once before borrowing into it.

## Find a skill

```console
$ shelf catalog
NAME                  TOKENS  DESCRIPTION
accessibility-audit   ~122    Audit interfaces for WCAG 2.2 issues: contrast, focus order, labels a…
api-design            ~127    Design consistent HTTP APIs: resource naming, error envelopes, pagina…
pdf-tools             ~116    Extract text, tables and form fields from PDFs, and fill or merge PDF…
playwright-testing    ~143    Write reliable end-to-end tests with Playwright: locators, fixtures a…
react-best-practices  ~195    Component structure, hooks rules and rendering performance for React …
```

- `shelf catalog <terms>` filters by name and description (every term must match).
- `shelf search <terms>` looks inside skills too: SKILL.md bodies and reference files, with the matching lines.
- `shelf suggest` lists library skills that match the project's dependencies and files.
- `shelf show <name>` prints the whole skill.

The token column is the size of the whole SKILL.md (characters / 4). Only a skill's name and description load at every session start; see [Context budget](context-budget.md).

## Borrow

```console
$ shelf borrow pdf-tools api-design
Borrowed pdf-tools (due 2026-11-06) → .agents/skills, .claude/skills
Borrowed api-design (due 2026-11-06) → .agents/skills, .claude/skills
```

Each skill is copied from its latest revision into every target directory, the loan is recorded with a due date, and the lockfile is rewritten. Borrowing a skill that is already borrowed changes nothing and says so:

```console
$ shelf borrow pdf-tools
pdf-tools is already borrowed (due 2026-11-06)
```

| Option | Effect |
|---|---|
| `--days N` | Loan length in days instead of the skill's loan length. At most `maxLoanDays`. |
| `--keep` | The loan never expires (also applies to skills already borrowed). |
| `--follow` | `shelf sync` applies library updates to this loan automatically. |
| `--link` | One copy in the first target; the other targets are symlinks to it. |
| `@<set>` | Borrow every skill in a set: `shelf borrow @frontend`. |

shelf refuses to overwrite a directory it doesn't manage. If `.claude/skills/pdf-tools` already exists with other content, `borrow` fails with `CONFLICT`; adopt the copy with `shelf adopt` instead (see [Migrating](migrating.md)). A leftover copy that is byte-identical to the revision being borrowed is taken over.

## Due dates

New loans are due after the skill's loan length: 30 days unless you changed `loanDays` in the config or set a length for the skill with `shelf loan-days`. From then on:

- **Using the skill renews it.** With the [hooks](hooks.md) installed, nothing else is needed: a loan only comes due after going unused for its loan length.
- **Due soon** means within 7 days (`dueSoonDays`). `shelf status` suggests renewing or returning, and the session-start note tells the agent.
- **Overdue** loans are returned by the next `shelf status`, `shelf sync`, `shelf sweep` or session start, unless the copy has local edits.

```console
$ shelf status
storefront  /home/me/code/storefront

SKILL                 CONTENT  DUE                   USED     POLICY  REVISION
accessibility-audit   current  2026-10-19  12d left  18d ago  pinned  78f143d800
git-hygiene           current  2026-10-13  6d left   never    pinned  098f8b659c
playwright-testing    current  2026-11-05  29d left  1d ago   pinned  a6bb6debdf
react-best-practices  current  2026-11-06  30d left  today    pinned  2bf910a993

Next steps:
  shelf renew git-hygiene --reason "<why>"
      git-hygiene has gone unused and is due in 6 day(s). Renew it if the project still needs it, otherwise `shelf return git-hygiene`
```

## Record a use

Harnesses without hooks can't tell shelf that a skill was used. Record it yourself (or have the agent do it):

```console
$ shelf used pdf-tools
pdf-tools: in use, due 2026-11-06
```

`shelf used` moves the due date to the loan length from now, exactly like a hook. Uses within an hour of the last one are not written again.

## Renew

```console
$ shelf renew api-design --reason "still designing the orders API"
api-design is now due 2026-11-06
```

`renew` sets the due date to `--days` or the skill's loan length from today, like a use does, unless the loan is already due later. The reason goes into the activity log. The result can't be more than `maxLoanDays` from today:

```console
$ shelf renew api-design --days 200
error: Due date 2027-06-24T05:34:17.582Z is beyond the 90-day loan limit
hint: The latest allowed due date is 2027-01-05
```

## Move a due date

`shelf due` moves a due date either way:

```console
$ shelf due api-design +14d
api-design is now due 2026-12-20

$ shelf due api-design 2026-12-01
api-design is now due 2026-12-01
```

Accepted forms: `+Nd`, `-Nd`, `+Nw`, `-Nw` (relative to the current due date) and `YYYY-MM-DD` (the end of that day, UTC). A negative shift moves it earlier: `shelf due api-design -7d`.

A date in the past makes the loan overdue: the next `shelf status` or `shelf sync` returns it.

## Keep

```console
$ shelf keep api-design --reason "the project is an HTTP API"
api-design is now kept; it never expires
```

A kept loan never comes due. `shelf status` shows `kept` in the due column. Keep only skills the project is built on, because kept skills load into every session forever. The decision is written to the lockfile, so every clone keeps the same skills.

```console
$ shelf keep api-design --off
Stopped keeping api-design; due 2026-12-01 unless used
```

When a loan stops being kept, its due date becomes at least one loan period from now.

## Return

```console
$ shelf return pdf-tools
Returned pdf-tools
```

`return` deletes the project's copies and closes the loan. If a copy has local edits, it refuses:

```console
$ shelf return pdf-tools
error: The project copy of "pdf-tools" has local edits
hint: Keep them with `shelf promote pdf-tools` or `shelf detach pdf-tools`, or discard them with --force
```

Never delete a skill copy by hand to return it: shelf sees deleted copies as `missing` and restores them.

## Detach

```console
$ shelf detach pdf-tools
Detached pdf-tools; its files now belong to the project
```

`detach` closes the loan but leaves the files where they are. shelf stops tracking them, and the lockfile entry is removed. Use it to keep a project-specific variant of a skill.

## Follow library updates

A loan borrowed with `--follow` takes new library revisions automatically:

```console
$ shelf borrow api-design pdf-tools --follow
Borrowed api-design (due 2026-11-06) → .agents/skills, .claude/skills
Borrowed pdf-tools (due 2026-11-06) → .agents/skills, .claude/skills

$ shelf sync          # later, after both skills changed in the library
Updated: api-design, pdf-tools
```

`shelf sync`, `shelf sweep` and the session-start hook update `follow` loans that are `behind`. Copies with local edits are never updated automatically. `shelf status` shows the policy in the `POLICY` column.

## Sync

```console
$ shelf sync
Restored: git-hygiene
```

`shelf sync` reconciles the project with its loans: it returns overdue loans without local edits, restores missing copies, and updates `follow` loans. The session-start hook runs the same sync. It prints `Everything is in sync.` when there is nothing to do.

## Related

- [Keeping skills current](keeping-skills-current.md): update, promote, propagate
- [Sets](sets.md)
- [`shelf borrow`](cli/borrow.md), [`shelf renew`](cli/renew.md), [`shelf due`](cli/due.md), [`shelf keep`](cli/keep.md), [`shelf return`](cli/return.md)
