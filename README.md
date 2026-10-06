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

## Install

shelf is pre-release. Build from source with [Bun](https://bun.com) 1.4:

```sh
git clone https://github.com/limyuquan/shelf && cd shelf
bun install
bun run build            # → dist/shelf (single binary)
install -m 755 dist/shelf ~/.local/bin/shelf
shelf setup              # creates ~/.shelf and installs the shelf skill for all agents
```

## Commands

| Command | |
|---|---|
| `shelf setup` | Create `~/.shelf` and install the bundled `shelf` skill into `~/.agents/skills` and `~/.claude/skills` |
| `shelf init` | Register the current project |
| `shelf status` | Loans, their states and suggested next steps. Returns overdue skills |
| `shelf new <name> -d <description>` | Create a library skill |
| `shelf catalog [terms]` | List library skills with a token estimate |
| `shelf show <name>` | Print a library skill |
| `shelf borrow <name…> [--days N] [--follow]` | Borrow skills into this project |
| `shelf renew <name> [--days N] [--reason …]` | Extend a loan |
| `shelf due <name> <+14d\|-7d\|2026-12-01>` | Move a due date either way |
| `shelf return <name> [--force]` | Remove a borrowed skill |
| `shelf update [name…] [--force]` | Update borrowed skills to the library's latest revision |
| `shelf promote <name> [--force]` | Publish a project's edits back to the library |
| `shelf detach <name>` | Stop managing a skill; keep its files |
| `shelf sync` | Return overdue, restore missing copies, update `--follow` loans |
| `shelf projects` | Every project using shelf, with loan counts |
| `shelf guide` | The full guide for agents |

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
| `targets` | `[".agents/skills", ".claude/skills"]` | Where borrowed skills are written |

Set `SHELF_HOME` to keep shelf's state elsewhere.

## Roadmap

- `shelf scan` / `shelf adopt`: find duplicated skills across your projects and
  turn them into loans from one library copy.
- `shelf promote --propagate`: push a library change to every clean borrower.
- `shelf diff`, revision history, `shelf sweep` across all projects.
- `shelf ui`: a local dashboard of projects, loans and due dates, with an editor.
- `shelf add <git-url>` with local security scanning.
- Prebuilt binaries for macOS, Linux and Windows.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design.

## License

[MIT](LICENSE)
