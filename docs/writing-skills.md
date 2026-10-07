# Writing skills

How to create and shape the skills in your library: the Agent Skills format, `shelf new`, editing, linting, what a skill costs in tokens, and renaming, duplicating, archiving and setting a skill's loan length.

## The format

A skill is a directory with a `SKILL.md`. shelf follows the [Agent Skills specification](https://agentskills.io/specification):

```markdown
---
name: pdf-tools
description: "Extract text, tables and form fields from PDFs, and fill or merge PDF files. Use when a task involves reading or producing PDFs."
---

# pdf-tools

Instructions the agent follows when it uses the skill.
```

| Field | Rules |
|---|---|
| `name` | Required. 1 to 64 lowercase letters, digits and single hyphens. Must match the directory name. |
| `description` | Required. Non-empty, at most 1024 characters. |

Anything else in the directory (reference files, scripts, templates) is part of the skill: it is hashed, versioned and copied with it. `.DS_Store`, `Thumbs.db`, `desktop.ini` and `.git` are ignored.

shelf never writes its own fields into SKILL.md. Tracking data lives in the lockfile and database, so hashes match the library and strict validators keep accepting the skill. The one exception is `shelf rename` and `shelf duplicate`, which change the library copy's `name:`.

## Create a skill

```console
$ shelf new pdf-tools -d "Extract text, tables and form fields from PDFs, and fill or merge PDF files. Use when a task involves reading or producing PDFs."
Created pdf-tools at /home/me/.shelf/library/pdf-tools
Edit its files with any editor; shelf records each change as a new revision.
```

The new SKILL.md holds the frontmatter and a placeholder body:

```markdown
---
name: pdf-tools
description: "Extract text, tables and form fields from PDFs, and fill or merge PDF files. Use when a task involves reading or producing PDFs."
---

# pdf-tools

Describe when and how an agent should apply this skill.
```

In the dashboard, **Library → New skill** does the same and shows the description's session cost as you type.

## Edit a skill

Edit the files in `~/.shelf/library/<name>/` with any tool, or open the skill in the dashboard, which has an editor for SKILL.md and reference files with a lint strip above it. There is no save step in shelf itself: the next command that reads the library hashes the directory and records a new revision if anything changed.

To try an edit inside a project first, edit the borrowed copy there and [promote](keeping-skills-current.md#promote-a-projects-edits) it when it works.

## Write a good description

Agents decide whether to use a skill from its name and description alone, and every session loads the description of every skill available to it. So a description should:

- say what the skill does, in concrete terms;
- say when to use it: "Use when …";
- stay short. Under 300 characters is a good target.

## Lint

`shelf lint` checks SKILL.md files against the format and these conventions:

```console
$ shelf lint
api-design  ~31 description + ~18 body tokens  ok
git-hygiene  ~17 description + ~18 body tokens
  warning: description doesn't say when to use the skill: add "Use when …"
pdf-tools  ~32 description + ~17 body tokens  ok
```

| Level | Check |
|---|---|
| error | SKILL.md must start with YAML frontmatter between `---` lines. |
| error | The frontmatter must be valid YAML, as `key: value` pairs. |
| error | `name` is required, must be a string of at most 64 characters, lowercase letters, digits and single hyphens, and must match the directory. |
| error | The directory name must be a valid skill name too. |
| error | `description` is required, must be a string, at most 1024 characters. |
| warning | The description is longer than 300 characters. |
| warning | The description doesn't say when to use the skill (no "when", "whenever", "if you", "if the user", "use for", "use to"). |
| warning | The body is empty. |

`shelf lint` exits with code 1 when any skill has an error. Warnings don't change the exit code. Name skills to lint only those; with no names it lints the whole library.

A library directory that fails the basic checks shelf needs to load a skill (frontmatter present, `name` matching the directory, a `description` of at most 1024 characters) is not loaded at all: other commands skip it, and `shelf doctor` reports it under `library`. `shelf lint` goes by the library's directories, so it still lints such a skill and reports why it doesn't load:

```console
$ shelf lint broken
broken  ~0 description + ~17 body tokens
  error: description is required
```

## What a skill costs

Token counts are estimates: characters divided by 4, rounded up.

| Where | What is counted |
|---|---|
| `shelf lint` | The description, and the body (everything after the frontmatter), separately. |
| `shelf insights`, `shelf suggest`, dashboard session cost | The name plus the description: what loads at every session start. |
| `shelf catalog`, `shelf show` | The whole SKILL.md: what loading the skill costs. |

The session cost is paid by every project that borrows the skill, in every session. The body is paid only when an agent uses the skill. See [Context budget](context-budget.md).

## Rename

```sh
shelf rename commit-style commit-messages
```

`rename` moves the directory and rewrites only the frontmatter `name:` value, keeping its quoting. Revisions, loans and activity stay attached to the skill, and the changed SKILL.md becomes a new revision. It is refused while any project borrows the skill, because project copies and lockfiles carry the name:

```console
$ shelf rename react-best-practices react-patterns
error: react-best-practices is borrowed by storefront. Renaming it would orphan their copies and lockfiles.
hint: Return it from storefront first (`shelf return react-best-practices` in each project)
```

## Duplicate

```console
$ shelf duplicate git-hygiene commit-style
Copied git-hygiene to commit-style at /home/me/.shelf/library/commit-style
```

The copy is a new skill with its own history, starting from the original's current files with `name:` changed.

## Archive

```console
$ shelf archive commit-messages
Archived commit-messages to /home/me/.shelf/archive/commit-messages-2026-10-07T05-35-15
Its revisions are kept. To restore it, move that directory back into the library.
```

Archiving moves the directory to `~/.shelf/archive/<name>-<timestamp>/`. Nothing is deleted: its revisions stay in the object store, and moving the directory back to `~/.shelf/library/<name>` restores the skill with its history. Like rename, it is refused while the skill is borrowed.

An archived skill keeps its name. `rename` and `duplicate` refuse to use it (`SKILL_EXISTS`). `shelf new` with that name, or a new directory with that name in the library, brings the archived skill back and continues its history with the new content.

Deleting a skill's directory from the library is treated like archiving, except the files are gone. Archive instead, so you can restore it.

## Loan length

Some skills are needed rarely but reliably, such as a migrations skill used once a month. Give them longer loans:

```console
$ shelf loan-days sql-migrations 60
sql-migrations: loans last 60 days (set for this skill)

$ shelf loan-days sql-migrations --reset
sql-migrations: loans last 30 days (the default, config loanDays)
```

The loan length is how long new loans last and how far a use or renewal moves the due date. It is a setting of your library on this machine, capped at `maxLoanDays`. Existing due dates don't change until the skill is next used or renewed.

## Related

- [Keeping skills current](keeping-skills-current.md)
- [Importing skills](importing-skills.md)
- [`shelf new`](cli/new.md), [`shelf lint`](cli/lint.md), [`shelf rename`](cli/rename.md), [`shelf duplicate`](cli/duplicate.md), [`shelf archive`](cli/archive.md), [`shelf loan-days`](cli/loan-days.md)
