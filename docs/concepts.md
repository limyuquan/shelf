# Concepts

Every term shelf uses, defined precisely: library, skill, revision, project, loan, target, harness, due date, loan length, renew on use, keep, policy, mode, content states, the lockfile, sets and actors.

## Library and skills

The **library** is the directory `~/.shelf/library` (or `$SHELF_HOME/library`). Each subdirectory with a `SKILL.md` is a **skill**, in the [Agent Skills](https://agentskills.io/specification) format: YAML frontmatter with a `name` that matches the directory and a `description`, followed by instructions, plus any reference files or scripts.

You edit the library with any tool. There is no daemon: every shelf command that reads skills first reconciles the library with the database, recording a new revision for anything that changed. A library directory that isn't a valid skill is skipped with a warning (see `shelf doctor`).

Skill names are 1 to 64 characters of lowercase letters, digits and single hyphens, with no leading or trailing hyphen: `pdf-tools`, `react-best-practices`.

## Revisions

A **revision** is an immutable snapshot of a skill directory, named by its content hash: SHA-256 over every file's relative path and the SHA-256 of its bytes, written `sha256:9f86d0…`. Commands show the first 10 hex characters (`ddad27dd34`) and accept any unique prefix of at least 6.

Snapshots live in `~/.shelf/objects/<hash>/` and are never deleted. Each revision records its parent and its source:

| Source | Recorded when |
|---|---|
| `library` | The library copy was edited (or created with `shelf new`, or restored). |
| `promote` | A project's edits were published with `shelf promote`. |
| `import` | `shelf add` imported the skill, or `shelf pull` updated it. |
| `adopt` | `shelf adopt --unedited` recorded an older copy found in a project. |

The library's **latest** revision (its head) is what new loans get. `shelf log <name>` lists every revision and which projects hold it; `shelf restore` makes an earlier one the latest again.

## Projects

A **project** is a directory that uses shelf, marked by `.agents/shelf.lock.json`. shelf finds the project root by walking up from the working directory: the nearest directory with a lockfile, else the nearest git root, else the working directory itself. Run commands from anywhere inside the project.

`shelf init` registers a project. A clone of a project that already has a lockfile is recognised and registered the first time any shelf command runs in it, because the lockfile carries the project's id. A moved directory is followed the same way. The project's name is its directory name.

## Loans

A **loan** is a project borrowing one revision of one skill until a **due date**. Loans live in the database (`~/.shelf/shelf.db`) on your machine. Each loan has:

| Field | Meaning |
|---|---|
| revision | The revision the project holds (its base). |
| targets | The directories the skill is copied into. |
| due date | When the loan expires unless renewed. |
| last used | The last time an agent was seen using the skill in this project. |
| kept | Kept loans never come due. |
| policy | `pinned` or `follow`. |
| mode | `copy` or `link`. |

**Borrow** creates a loan and writes the copies. **Return** removes the copies and closes the loan. **Detach** closes the loan but leaves the files, which then belong to the project.

## Targets and harnesses

A **harness** is a coding agent that reads skills: Claude Code, Codex, Cursor and so on. A **target** is a project-relative directory that skills are copied into, such as `.claude/skills`.

The default targets are `.agents/skills` (the cross-harness convention, read by Codex, Cursor, Gemini CLI, Copilot, OpenCode, Amp, Goose, Cline and others) and `.claude/skills` (Claude Code). A project can add directories for harnesses that read neither, such as Kiro, with `shelf targets --add kiro`. See [Harnesses](harnesses.md).

## Mode: copy or link

| Mode | What is written |
|---|---|
| `copy` (default) | A full copy of the skill in every target. |
| `link` | One real copy in the first target; the others are relative symlinks to it (junctions on Windows). |

Copies are the default because symlinked skills are unreliable in some harnesses and across the WSL/Windows boundary. Choose link mode per loan with `shelf borrow --link`, or for every new loan with `"mode": "link"` in the [config](configuration.md). Hashes follow symlinks, so content states work the same in both modes.

## Due dates and loan length

Every loan that isn't kept has a due date. A skill's **loan length** decides how far out it is set:

- the skill's own loan length, set with `shelf loan-days <name> <days>` (a setting of your library on this machine), else
- `loanDays` from the config (30 by default),
- never more than `maxLoanDays` (90 by default).

| Event | New due date |
|---|---|
| `shelf borrow` | Now plus `--days`, or the loan length. |
| An agent uses the skill | Now plus the loan length, if that is later than the current due date. |
| `shelf renew` | The current due date (or now, if overdue) plus `--days`, or the loan length. |
| `shelf due <name> +14d` | The current due date shifted by the amount. |
| `shelf due <name> 2026-12-01` | The end of that day, UTC. |

No command sets a due date more than `maxLoanDays` from now; trying fails with `LOAN_LIMIT`.

## Due states

| State | Meaning |
|---|---|
| `active` | More than `dueSoonDays` (7 by default) days left, or kept. |
| `due-soon` | Due within `dueSoonDays` days. With hooks installed, this means the skill has gone unused for a while. |
| `overdue` | The due date has passed. |

## Renew on use

Loans renew when they are used, so a due date really means "unused for a loan period". [Hooks](hooks.md) installed by `shelf setup` recognise a borrowed skill being used in Claude Code and Codex (the Skill tool naming it, a tool reading a file inside its copy, or a prompt invoking `/name`) and record the use. In harnesses without hooks, agents run `shelf used <name>` after using a skill.

A use is written at most once an hour per loan, and appears in the activity log at most once a day.

## Expiry

An overdue loan is returned automatically by the next `shelf status`, `shelf sync` or `shelf sweep` in its project, or the next session start (the session-start hook runs a sync). The copies are deleted and the loan is closed.

shelf never deletes local edits. An overdue loan whose copy is `modified` or `diverged` stays, and the next steps tell you to promote or detach it.

## Keep

A **kept** loan never comes due. Its due state is always `active`, nothing expires it, and uses are still recorded. Keep a skill with `shelf keep <name>` or borrow it with `shelf borrow <name> --keep`; stop with `shelf keep <name> --off`. A loan that stops being kept gets at least a fresh loan period.

Keeping is a project decision, so it is written to the lockfile (`"keep": true`) and every clone keeps the same skills. Kept skills load into every session forever, so keep only what the project is built on: Convex skills in a Convex app, the API design skill in an API service. Agents follow the same rule.

## Policy: pinned or follow

| Policy | When the library has a newer revision |
|---|---|
| `pinned` (default) | The loan is `behind` until someone runs `shelf update` (or `shelf propagate` from the library side). |
| `follow` | `shelf sync`, `shelf sweep` and the session-start hook update it automatically, as long as the copy has no local edits. |

Choose `follow` with `shelf borrow <name> --follow`.

## Content states

Each loan's **content state** compares three hashes: the revision the project borrowed (base), the library's latest revision (head) and each copy on disk (working).

| State | Meaning | What to do |
|---|---|---|
| `current` | Every copy matches the borrowed revision, which is the latest. | Nothing. |
| `behind` | The copies are unedited, but the library has a newer revision. | `shelf update <name>` |
| `modified` | A copy was edited in the project; the library hasn't changed. | `shelf promote <name>` to publish, `shelf detach <name>` to keep the edits unmanaged, or `shelf update <name> --force` to discard them. |
| `diverged` | A copy was edited, and the library has changed too. | Review with `shelf diff`, then `shelf promote <name> --force` or `shelf update <name> --force`. |
| `missing` | Some copies were deleted and the remaining ones are unedited. | `shelf sync` restores them. |

Edits take precedence over missing copies: a loan with one edited copy and one deleted copy is `modified`, so restoring can never overwrite edits. Every operation that would discard edits (`return`, `update`, `promote` over a newer library revision, expiry, removing a target) refuses unless forced.

## The lockfile

`.agents/shelf.lock.json` records which skills shelf manages in the project, at which revision, in which directories, and whether they are kept. It has no timestamps, so renewing a loan never changes it and committing it causes no merge churn. Commit it; never edit it by hand. See [Lockfile](lockfile.md).

## Sets

A **set** is a named group of library skills, such as `frontend` for `react-best-practices`, `playwright-testing` and `accessibility-audit`. `shelf borrow @frontend` borrows every skill in it. Each skill still gets its own loan, due date and lockfile entry; nothing about the set reaches the project. Sets live in your database, per machine. See [Sets](sets.md).

## Actors and the activity log

Every change is recorded in the activity log with its **actor**: who did it.

| Actor | When |
|---|---|
| `user` | You, at a terminal. |
| `user:dashboard` | You, in `shelf ui`. |
| `agent:claude-code`, `agent:codex` | Commands run inside those harnesses, and their hooks. |
| `agent:<name>` | Other harnesses that set `AI_AGENT`. |
| anything | Set with `--actor` or `SHELF_ACTOR`. |
| `unknown` | Not a terminal and no harness detected (for example a cron job). |

The dashboard's Activity page shows the log as a timeline. Agents are restricted in one place: they may not import skills from remote sources unless you allow it. See [Environment](environment.md) for how the actor is detected and [Importing skills](importing-skills.md) for the rule.
