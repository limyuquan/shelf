# shelf

A personal skill library for coding agents. Keep your [Agent Skills](https://agentskills.io)
in one library, **borrow** them into the projects that need them, and let loans
**expire** so stale skills don't pile up. Agents renew what they use and return
what they don't.

```console
$ shelf borrow pdf-tools git-hygiene
Borrowed pdf-tools until 2026-11-05 → .agents/skills, .claude/skills
Borrowed git-hygiene until 2026-11-05 → .agents/skills, .claude/skills

$ shelf status
my-app  /home/me/code/my-app

SKILL        CONTENT  DUE                   POLICY  REVISION
git-hygiene  current  2026-11-05  30d left  pinned  cc0ff536b8
pdf-tools    behind   2026-10-09   3d left  pinned  ae40770b0e

Next steps:
  shelf update pdf-tools
      The library has a newer revision of pdf-tools
  shelf renew pdf-tools --reason "<why>"
      pdf-tools is due in 3 day(s). Renew it if it is still useful, otherwise `shelf return pdf-tools`
```

## Why

- **Copy-pasted skills drift.** The same skill lives in ten repos at ten
  different versions, and nobody knows which is current.
- **Global skill folders are harness-specific and load everywhere.** A skill in
  `~/.claude/skills` is invisible to Codex or Cursor, and is loaded into every
  project whether it is relevant or not.
- **Skill registries are a supply-chain risk** and treat your own skills as
  second-class.

shelf makes your own library the source of truth and the trust boundary. Agents
borrow only from it.

## How it works

- **Library**: `~/.shelf/library/<skill>/`. Edit skills with any editor; shelf
  records each change as an immutable, content-addressed revision.
- **Loan**: a project borrows one revision of a skill until a due date. The
  skill is copied into `.agents/skills/` (read by Codex, Cursor, Gemini CLI,
  Copilot, OpenCode, Amp, Goose, Cline, …) and `.claude/skills/` (Claude Code).
- **Lockfile**: `.agents/shelf.lock.json` records which skills shelf manages and
  at which revision. It has no timestamps, so commit it without merge churn.
- **Expiry**: overdue loans are returned automatically the next time `shelf
  status` or `shelf sync` runs — unless the project copy has local edits, which
  shelf never deletes.
- **Propagation is explicit**: edits flow from project to library with
  `shelf promote` and from library to projects with `shelf update` (or
  automatically for loans borrowed with `--follow`).

Each loan has a **content** state — `current`, `behind`, `modified`, `diverged`
or `missing` — computed from three hashes: the revision borrowed, the library's
latest, and the files on disk.

## Migrating existing skills

```sh
shelf scan ~/code          # every skill copy, grouped by name and content
shelf adopt ~/code/app/.claude/skills/review ~/code/api/.claude/skills/review
```

The first copy adopted becomes the library version. Copies that differ are
adopted as loans with local edits (`modified`), so nothing is overwritten:
`shelf diff`, then `shelf promote --propagate` the best one or
`shelf update --force` to take the library's.

To return overdue loans everywhere without visiting each project, run
`shelf sweep` daily (cron, systemd timer, launchd).

## Dashboard

`shelf ui` opens a local dashboard: every project with its borrowed skills and
due dates (renew, move, update, return, borrow), the library with a SKILL.md
editor, revision diffs and "update these borrowers" after an edit, and the
activity log with agents' renewal reasons. It listens on 127.0.0.1 only and
requires the one-time token in the URL it prints.

## Install

Download a binary from the [releases page](https://github.com/limyuquan/shelf/releases)
(macOS, Linux, Windows; verify with `SHA256SUMS`), or with npm:

```sh
npm install -g @limyuquan/shelf   # installs only your platform's binary; no install scripts
shelf setup                       # creates ~/.shelf and installs the shelf skill for your agents
```

The binaries are not code-signed yet. On macOS, a browser-downloaded binary
needs `xattr -d com.apple.quarantine shelf` once (npm installs are not affected).

To build from source with [Bun](https://bun.com) 1.4: `bun install && bun run build`
produces `dist/shelf`.

## Importing skills from elsewhere

```sh
shelf add gh:someone/skills/pdf-tools   # fetch and audit — nothing is imported yet
shelf add gh:someone/skills/pdf-tools --yes
shelf pull pdf-tools                    # later: diff + fresh audit of upstream changes
shelf pull pdf-tools --yes && shelf propagate pdf-tools
shelf audit                             # scan your whole library, including your own skills
```

`add` accepts `gh:owner/repo[/path][@ref]`, GitHub `/tree/` URLs, any git URL,
or a local directory. Every import and pull is audited locally (pipe-to-shell,
prompt-injection phrasing, hidden Unicode, file uploads, credential access,
binaries, scripts…). High-severity findings block the import unless you add
`--force`. Agents cannot import from remote sources unless you set
`allowAgentImports`: your library stays the trust boundary.

## Commands

| Command | |
|---|---|
| `shelf setup` | Create `~/.shelf` and install the bundled `shelf` skill for your agents |
| `shelf init` | Register the current project |
| `shelf status` | Loans, their states and suggested next steps. Returns overdue skills |
| `shelf guide` | The full guide for agents |
| **Library** | |
| `shelf new <name> -d <description>` | Create a library skill |
| `shelf catalog [terms]` | List library skills with a token estimate |
| `shelf show <name>` | Print a library skill |
| `shelf log <name>` | A skill's revisions and which projects borrow each |
| `shelf diff <name> [--from X] [--to Y]` | Diff `borrowed`, `library`, `project` or a revision |
| `shelf propagate <name> [--project a,b] [--dry-run]` | Push the library's latest revision to every clean borrower |
| `shelf add <source> [--yes] [--force]` | Import skills from git or a directory, after a local audit |
| `shelf pull <name> [--yes]` | Update an imported skill from its source |
| `shelf audit [name…]` | Scan library skills for risky content |
| **This project** | |
| `shelf borrow <name…> [--days N] [--follow] [--link]` | Borrow skills into this project |
| `shelf renew <name> [--days N] [--reason …]` | Extend a loan |
| `shelf due <name> <+14d\|-7d\|2026-12-01>` | Move a due date either way |
| `shelf return <name> [--force]` | Remove a borrowed skill |
| `shelf update [name…] [--force]` | Update borrowed skills to the library's latest revision |
| `shelf promote <name> [--force] [--propagate]` | Publish a project's edits back to the library (and to other borrowers) |
| `shelf detach <name>` | Stop managing a skill; keep its files |
| `shelf sync` | Return overdue, restore missing copies, update `--follow` loans |
| `shelf targets [--add ids] [--remove ids] [--reset]` | Which harness skill directories this project uses |
| **Everywhere** | |
| `shelf scan [dir]` | Find skill copies under a directory, grouped by name and version |
| `shelf adopt <path…>` | Import existing skills into the library and manage their copies as loans |
| `shelf projects` | Every project using shelf, with loan counts |
| `shelf sweep` | `sync` every registered project (cron-friendly) |
| `shelf doctor [--fix]` | Check and repair shelf's state |
| `shelf ui [--port N] [--no-open]` | Local dashboard: projects, loans, due dates, library editor, activity |

### Harnesses and link mode

Skills go to `.agents/skills` and `.claude/skills` by default. `shelf targets`
lists every known harness, marks the ones it detects in the project, and
suggests adding those that don't read `.agents/skills` (e.g.
`shelf targets --add kiro`). The project's targets are stored in its lockfile.

`shelf borrow --link` (or `"mode": "link"` in config) keeps one real copy in the
first target and makes the others relative symlinks to it (junctions on
Windows). Copies are the default because symlinked skills are unreliable in some
harnesses and across the WSL/Windows boundary.

## For agents

Every command accepts `--json` and prints exactly one line:

```json
{ "schemaVersion": 1, "ok": true, "data": { … } }
{ "schemaVersion": 1, "ok": false, "error": { "code": "SKILL_NOT_FOUND", "message": "…", "hint": "Run `shelf catalog` …" } }
```

Commands never prompt, are safe to retry, and exit non-zero with a distinct
code per error class. `shelf status --json` returns `data.actions`: runnable
next steps, so one call at session start is enough. The bundled skill is about
ten lines; the details live in `shelf guide`.

## Configuration

`~/.shelf/config.json` (created by `shelf setup`):

| Key | Default | |
|---|---|---|
| `loanDays` | `30` | Loan length and default renewal |
| `maxLoanDays` | `90` | Due dates can't be set further out than this |
| `dueSoonDays` | `7` | When a loan counts as `due-soon` |
| `targets` | `[".agents/skills", ".claude/skills"]` | Where borrowed skills are written (a project can override with `shelf targets`) |
| `mode` | `"copy"` | `"link"`: one copy per project, other targets symlink to it |
| `allowAgentImports` | `false` | Let agents run `shelf add` / `shelf pull` from remote sources |

Set `SHELF_HOME` to keep shelf's state elsewhere.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design.

## License

[MIT](LICENSE)
