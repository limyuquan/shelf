# CLI overview

Every shelf command takes `--json`, never prompts, and exits with a code that says what went wrong, so agents can drive it as easily as people.

## Global options

| Option | Description |
|---|---|
| `--json` | Print a single-line JSON envelope `{ schemaVersion, ok, data \| error }` |
| `--actor <name>` | Who is acting, recorded in the activity log (default: auto-detected) |

```console
$ shelf status --json
{"schemaVersion":1,"ok":true,"data":{"project":{"name":"storefront"}}}
```

## Commands

<!-- generated:cli-index -->

### Getting started

| Command | Description |
| --- | --- |
| [`shelf setup`](setup.md) | Create the shelf home, install the shelf skill and the hooks that renew skills on use (safe to re-run) |
| [`shelf init`](init.md) | Register the current project with shelf (creates .agents/shelf.lock.json) |
| [`shelf status`](status.md) | Show this project's loans and suggested next steps (returns overdue skills) |
| [`shelf guide`](guide.md) | Print the full guide for agents |

### Library

| Command | Description |
| --- | --- |
| [`shelf new`](new.md) | Create a skill in your library |
| [`shelf catalog`](catalog.md) | List library skills, optionally filtered by search terms |
| [`shelf search`](search.md) | Find library skills by what they say: names, descriptions, SKILL.md and references |
| [`shelf show`](show.md) | Print a library skill's SKILL.md and file list |
| [`shelf log`](log.md) | Show a skill's revisions and which projects borrow each |
| [`shelf diff`](diff.md) | Diff two versions of a skill: borrowed, library, project, or a revision |
| [`shelf propagate`](propagate.md) | Push the library's latest revision of a skill to every borrowing project |
| [`shelf restore`](restore.md) | Make an earlier revision of a skill the library's latest again |
| [`shelf loan-days`](loan-days.md) | Show or set a skill's loan length (how long loans and renewals last) |
| [`shelf set`](set.md) | Group library skills into sets, borrowed together with `shelf borrow @<set>` |
| [`shelf set list`](set.md) | List your skill sets |
| [`shelf set save`](set.md) | Create a set, or replace its skills (accepts @set to extend another set) |
| [`shelf set delete`](set.md) | Delete a set (borrowed skills and loans are unaffected) |
| [`shelf rename`](rename.md) | Rename a library skill (its directory and frontmatter name), keeping its history |
| [`shelf duplicate`](duplicate.md) | Copy a library skill to a new name, as a new skill with its own history |
| [`shelf archive`](archive.md) | Move a library skill to the archive (nothing is deleted) |
| [`shelf lint`](lint.md) | Check skills' SKILL.md against the Agent Skills format (exits 1 on errors) |

### Loans in the current project

| Command | Description |
| --- | --- |
| [`shelf insights`](insights.md) | Context each project loads at session start, and which skills agents actually use (30 days) |
| [`shelf suggest`](suggest.md) | Suggest library skills that match what this project uses (its dependencies, files) |
| [`shelf borrow`](borrow.md) | Copy library skills into this project with a due date |
| [`shelf renew`](renew.md) | Renew a loan: due the loan length (or --days) from today, unless already due later |
| [`shelf used`](used.md) | Record that borrowed skills were used, which renews them (hooks do this for you) |
| [`shelf due`](due.md) | Move a loan's due date: +14d, -7d, +2w or 2026-12-01 |
| [`shelf keep`](keep.md) | Keep borrowed skills: they never expire (--off to stop keeping) |
| [`shelf return`](return.md) | Remove a borrowed skill from this project |
| [`shelf update`](update.md) | Update borrowed skills to the library's latest revision (all if none named) |
| [`shelf promote`](promote.md) | Publish this project's edits to a skill back to the library |
| [`shelf detach`](detach.md) | Stop managing a skill; its files stay in the project |
| [`shelf sync`](sync.md) | Return overdue skills, restore missing copies, apply updates to --follow loans |
| [`shelf targets`](targets.md) | Show or change which harness skill directories this project uses |

### Bringing skills in: existing copies, or from outside

| Command | Description |
| --- | --- |
| [`shelf scan`](scan.md) | Find skill copies under a directory and group duplicates and drifted versions |
| [`shelf adopt`](adopt.md) | Import existing skill directories into the library and manage them as loans |
| [`shelf add`](add.md) | Import skills from a git repository or directory (reviews first; --yes imports) |
| [`shelf pull`](pull.md) | Update an imported skill from its source (shows diff and audit; --yes applies) |
| [`shelf audit`](audit.md) | Scan library skills for risky content (all, or the named ones) |

### Across projects

| Command | Description |
| --- | --- |
| [`shelf projects`](projects.md) | List every project using shelf, with loan counts |
| [`shelf sweep`](sweep.md) | Run `sync` in every registered project (e.g. from a daily cron job) |
| [`shelf doctor`](doctor.md) | Check shelf's state for problems; --fix repairs what it safely can |
| [`shelf ui`](ui.md) | Open the local dashboard (projects, loans, library editor) |

### Called by harness hooks, not people

| Command | Description |
| --- | --- |
| [`shelf hook`](hook.md) | Run a harness hook (installed by `shelf setup`; reads the payload on stdin) |

<!-- /generated -->

Exit codes are listed in [Configuration](../configuration.md#exit-codes).
