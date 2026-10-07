# Errors

Every error code shelf returns, its exit code, what causes it, and what to do about it. Codes are stable: agents and scripts should branch on `error.code`, and read `error.hint` for the exact fix.

## How errors look

Without `--json`, on stderr:

```console
$ shelf return pdf-tools
error: The project copy of "pdf-tools" has local edits
hint: Keep them with `shelf promote pdf-tools` or `shelf detach pdf-tools`, or discard them with --force
```

With `--json`, one line on stdout:

```json
{"schemaVersion":1,"ok":false,"error":{"code":"NOT_BORROWED","message":"\"nope\" is not borrowed by storefront","hint":"Run `shelf borrow nope` first"}}
```

`hint` is `null` when there is nothing more specific to say than the message.

## Codes

<!-- generated:errors -->

| Code | Exit code | Meaning |
| --- | --- | --- |
| `INTERNAL` | 1 | Anything that is not a ShelfError: a bug or an unexpected I/O error. The message says what failed. |
| `INVALID_ARGUMENT` | 2 | A missing or malformed argument, option or config value, or a request that does not apply (for example promoting a copy with no local edits). |
| `INVALID_SKILL` | 2 | A SKILL.md is missing, has no or invalid YAML frontmatter, or breaks a rule of the Agent Skills spec (name, description). |
| `NOT_INITIALIZED` | 3 | The current directory is not in a shelf project. Run `shelf init` in the project root. |
| `SKILL_NOT_FOUND` | 4 | No skill, set or source entry by that name. |
| `NOT_BORROWED` | 4 | The skill is in the library, but this project has not borrowed it. |
| `SKILL_EXISTS` | 5 | A skill or set with that name already exists. |
| `CONFLICT` | 5 | The operation would overwrite or orphan something: files shelf does not manage, a newer library revision, copies edited differently, or loans in other projects. |
| `LOCAL_CHANGES` | 6 | The project copy has local edits that the operation would discard. Promote or detach them first, or pass `--force`. |
| `LOAN_LIMIT` | 7 | The requested loan length or due date is beyond `maxLoanDays`. |
| `NOT_ALLOWED` | 8 | The actor may not do this, for example an agent importing from a remote source while `allowAgentImports` is off. |

<!-- /generated -->

`INTERNAL` (exit 1) is not a shelf error code but what the CLI reports for anything unexpected: a bug, a full disk, a port in use. The message is the underlying error; text output adds a stack trace. Please report reproducible ones.

## What to do

### INVALID_ARGUMENT

An argument, option or file shelf reads is not acceptable. Read the message; it names the value.

| Cause | Fix |
|---|---|
| Unknown command, missing argument (with `--json`) | `shelf <command> --help` |
| An invalid skill or set name | 1 to 64 lowercase letters, digits and single hyphens |
| A number option (`--days`, `--limit`, `--depth`, `--port`) that isn't a positive integer | Pass a whole number above 0 |
| A due expression that isn't `+Nd`, `-Nd`, `+Nw`, `-Nw` or `YYYY-MM-DD` | Use one of those; put `--` before negative shifts |
| A revision that is too short, ambiguous or unknown | At least 6 hex characters; `shelf log <name>` lists them |
| `shelf promote` on a copy without edits | Nothing to promote |
| `shelf pull` on a skill without a source | Link it first with `shelf add <source> --yes` |
| `shelf add`: no SKILL.md, several skills without `--skill`/`--all`, a failed clone | Follow the hint |
| `shelf targets`: a path outside the project, or no targets left | Use a harness id or a project-relative directory |
| `shelf adopt` on a path inside the shelf home | It is already managed |
| An invalid `config.json` | Fix the file; the message names the key |

### INVALID_SKILL

A SKILL.md isn't a valid skill: no frontmatter, invalid YAML, a `name` that doesn't match its directory, a missing or overlong description. It comes from commands that read a skill directory you point at (`adopt`, `add`, `promote`, `restore`, `rename`). Fix the frontmatter; `shelf lint` and [Writing skills](writing-skills.md) list the rules.

### NOT_INITIALIZED

The working directory isn't inside a shelf project, and the command needs one (`borrow`, `renew`, `return`, `sync`, `targets`, `suggest`, …). Run the command inside the project, or `shelf init` in its root if it should start using shelf. Agents shouldn't run `init` unless asked.

### SKILL_NOT_FOUND

No skill (or set) by that name. `shelf catalog` lists skills, `shelf set list` lists sets. Archived skills and library directories that aren't valid skills (see `shelf doctor`) count as not found. `shelf add --skill` uses it for a name the source doesn't have; the hint lists what it has.

### NOT_BORROWED

The project doesn't borrow that skill. `shelf status` lists its loans; `shelf borrow <name>` borrows it. `shelf diff` uses it when `borrowed` or `project` is asked for outside a project that borrows the skill.

### SKILL_EXISTS

The name is taken: a library directory with that name exists (`new`, `rename`, `duplicate`), an archived skill had that name (`rename`, `duplicate`), or the skill is already linked to a source (`add`; use `shelf pull`). Choose another name, or restore the archived skill by moving it back from `~/.shelf/archive/`.

### CONFLICT

The operation would clash with state shelf doesn't own or can't reconcile on its own.

| Cause | Fix |
|---|---|
| `borrow`: a target already has an unmanaged directory with the skill's name | Adopt it (`shelf adopt <path>`), or move it away |
| `promote`: the library changed since the project borrowed (`diverged`) | Review with `shelf diff`, then `--force` to replace the library's revision |
| `promote`: the copies in different targets were edited differently | Make them identical |
| `promote` or `diff --to project`: copies are missing | `shelf sync` |
| `pull`: the library copy was edited since the last import | `--force` to replace your edits with the source |
| `rename`, `archive`: the skill is borrowed | Return it from each borrowing project first |
| The lockfile isn't valid JSON or doesn't match its schema | Restore it from version control; never edit it by hand. See [Lockfile](lockfile.md) |
| A revision's snapshot is missing from the object store | `shelf doctor` |

### LOCAL_CHANGES

A project copy has local edits that the operation would discard: `return`, `update <name>`, or `targets --remove`. Keep the edits with `shelf promote <name>` (to the library) or `shelf detach <name>` (in the project), or discard them with `--force`.

### LOAN_LIMIT

The due date would be more than `maxLoanDays` (90 by default) from now: `borrow --days`, `renew`, `due` or `loan-days`. The hint gives the latest allowed date or number of days. Use a shorter period, or raise `maxLoanDays` in the [config](configuration.md). For a skill the project always needs, `shelf keep` is the alternative.

### NOT_ALLOWED

An agent tried to import a skill from a git source (`shelf add --yes` of a new skill, or `shelf pull --yes`) while `allowAgentImports` is `false`. The agent should show you the review and the exact command, for you to run. See [Importing skills](importing-skills.md#what-agents-may-do).

## Usage errors without --json

Without `--json`, an unknown command or a missing argument prints the command's help followed by the problem, and exits with code 1:

```console
$ shelf new nod
…
Missing required argument: --description
```

## Related

- [CLI reference](cli/index.md#exit-codes), [Troubleshooting](troubleshooting.md)
