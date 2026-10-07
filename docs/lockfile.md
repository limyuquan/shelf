# Lockfile

The format of `.agents/shelf.lock.json`, field by field: which skills shelf manages in a project, at which revision, in which directories, and whether they are kept. Why it has no timestamps, how clones use it, and why you should never edit it by hand.

## Example

```json
{
  "version": 1,
  "project": "da6c4e70-e25d-4d10-a389-b6ed7360fa5a",
  "targets": [
    ".agents/skills",
    ".claude/skills",
    ".kiro/skills"
  ],
  "skills": {
    "api-design": {
      "revision": "sha256:38faca9ff6bb0a09bdcf9b91c1671afa782b4962d317ffbfa4d2aa0ec9212ab7",
      "targets": [
        ".agents/skills",
        ".claude/skills"
      ],
      "keep": true
    },
    "pdf-tools": {
      "revision": "sha256:ddad27dd34082032a0f9564e301c57903aeb482c1f97b56b07844301a222bc36",
      "targets": [
        ".agents/skills",
        ".claude/skills"
      ],
      "mode": "link"
    }
  }
}
```

## Fields

| Field | Type | Meaning |
|---|---|---|
| `version` | `1` | The format version. |
| `project` | UUID | The project's id. It identifies the project across moves and clones. |
| `targets` | string array, optional | The project's own target directories, set by `shelf targets`. Omitted when the project uses your default targets from the config. |
| `skills` | object | One entry per managed skill, keyed by skill name, sorted by name. |
| `skills.<name>.revision` | string | The revision the project holds: `sha256:` and 64 hex characters, the content hash of the skill directory. |
| `skills.<name>.targets` | string array | The directories this skill is copied into, relative to the project root. At least one. |
| `skills.<name>.mode` | `"link"`, optional | Present for link-mode loans (one copy, symlinks elsewhere). Omitted for the default, copy. |
| `skills.<name>.keep` | `true`, optional | Present for kept loans, which never expire. Omitted otherwise. |

The file is JSON with two-space indentation and a trailing newline. It lives in `.agents/` whatever the project's targets are.

## Why no timestamps

Due dates, last uses and the activity log live in the database on your machine, not in the lockfile. Using or renewing a skill therefore never changes the file, so committing it causes no churn and no merge conflicts between branches. It changes only when what the project holds changes: a borrow, return, update, promote, keep, detach or targets change.

## What it is for

- **Recognising the project.** Commands walk up from the working directory to the nearest lockfile to find the project root. The `project` id lets a clone, or a moved directory, be recognised as the same project.
- **Sharing decisions.** Kept skills and project targets are project decisions, so they travel with the repository: a clone keeps the same skills and writes to the same directories.
- **Clones and other machines.** When shelf opens a project whose lockfile lists a skill it has no loan for, it creates the loan (pinned, with a fresh loan period, keep and mode from the lockfile). If the copies aren't there, the loan is `missing` and `shelf sync` (or the next session start) restores them, from the recorded revision if this machine has it, else from the library's latest.
- **Entries this machine doesn't know.** A skill that isn't in this machine's library is kept in the lockfile untouched, and commands warn: `Lockfile lists "x", which is not in this machine's library`. A machine never deletes another machine's entries.

## How it is written

shelf rewrites the whole file from the project's active loans after every change, inside the same database transaction, by writing a temporary file and renaming it into place. Several shelf processes in one project therefore never lose each other's entries.

## Commit it

Commit `.agents/shelf.lock.json`. Whether to also commit the skill copies is up to you:

- **Committed copies** work for everyone who clones the repository, with or without shelf. shelf tracks them by hash, so an edit shows up as `modified`.
- **Ignored copies** keep the repository smaller. Anyone with shelf restores them with `shelf sync` after cloning, provided their library has the skills.

## Never edit it by hand

The lockfile is derived from the database and rewritten on every change, so hand edits are overwritten or, if they break the schema, make every command in the project fail with `CONFLICT` until it is fixed. Use the commands instead:

| To | Run |
|---|---|
| Add a skill | `shelf borrow <name>` |
| Remove a skill | `shelf return <name>` or `shelf detach <name>` |
| Change a revision | `shelf update <name>`, `shelf promote <name>` |
| Keep or stop keeping | `shelf keep <name>`, `shelf keep <name> --off` |
| Change directories | `shelf targets --add/--remove/--reset` |

If a merge leaves conflict markers in it, resolve it to valid JSON by taking either side. On your machine the database is the source of truth for loans: the next change (a borrow, return, update, …) rewrites the file from them. The exception is `keep`, which shelf takes from the lockfile whenever it opens the project, and lockfile entries without a loan, which become loans.

## Related

- [Concepts](concepts.md#the-lockfile), [Files](files.md)
- [`shelf init`](cli/init.md), [`shelf targets`](cli/targets.md), [`shelf keep`](cli/keep.md)
