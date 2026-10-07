# shelf

A personal skill library for coding agents. Keep your [Agent Skills](https://agentskills.io)
in one library, **borrow** them into the projects that need them, and let loans
**expire** so stale skills don't pile up. Using a skill renews it; skills nobody
uses are returned.

```console
$ shelf borrow pdf-tools git-hygiene
Borrowed pdf-tools (due 2026-11-05) → .agents/skills, .claude/skills
Borrowed git-hygiene (due 2026-11-05) → .agents/skills, .claude/skills

$ shelf status
my-app  /home/me/code/my-app

SKILL        CONTENT  DUE                   USED     POLICY  REVISION
git-hygiene  current  2026-11-05  30d left  today    pinned  cc0ff536b8
pdf-tools    behind   2026-10-09   3d left  27d ago  pinned  ae40770b0e

Next steps:
  shelf update pdf-tools
      The library has a newer revision of pdf-tools
  shelf renew pdf-tools --reason "<why>"
      pdf-tools has gone unused and is due in 3 day(s). Renew it if the project still needs it, otherwise `shelf return pdf-tools`
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
- **Renew on use**: each time an agent uses a borrowed skill, its due date moves
  to 30 days out (or the skill's own loan length, `shelf loan-days`). A loan only
  comes due after going unused (see [Hooks](#hooks)).
- **Keep**: `shelf keep <name>` for skills a project always needs (say, Convex
  skills in a Convex app): kept loans never expire. It's recorded in the
  lockfile, so clones keep them too. Agents may keep skills as well; the guide
  tells them to keep only skills for a direct dependency of the project (kept
  skills load in every session, so keeping freely bloats context) and to give a
  `--reason`.
- **Sets**: `shelf set save frontend react-best-practices playwright-testing`
  groups skills you often borrow together; `shelf borrow @frontend` borrows
  them all. Sets live in your library (per machine); each skill still gets its
  own loan, due date and lockfile entry.
- **Expiry**: overdue loans are returned automatically at the next session
  start, `shelf status` or `shelf sync` — unless the project copy has local
  edits, which shelf never deletes.
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
`shelf update --force` to take the library's. If the copies were never edited
and only differ because they were installed at different times, adopt the
newest first with `--unedited`: the others become `behind` and a plain
`shelf update` brings them up to date.

In the dashboard, **Library → Find existing skills** (or ⌘K) does the same: it
scans the folder that holds your projects, groups the copies it finds by name
and version, and adopts the ones you tick. It adopts each skill's library or
most common version first.

Skills that came from a public repository can then be linked to it, so you can
pull their updates later: `shelf add gh:owner/repo --skill <name> --yes` on a
skill the library already has records the source without changing it.

To return overdue loans everywhere without visiting each project, run
`shelf sweep` daily (cron, systemd timer, launchd).

## Hooks

`shelf setup` installs hooks in Claude Code (`~/.claude/settings.json`) and
Codex (`~/.codex/hooks.json`), next to your existing settings:

- **Session start**: syncs the project (returns overdue skills, restores
  missing copies) and adds one `shelf: …` line to the agent's context *only*
  when something needs attention — a skill due soon, local edits, library
  updates. A healthy project costs no tokens.
- **Skill use**: after tool calls and prompts, recognises a borrowed skill
  being used (the Skill tool, reading its files, `/skill-name`) and renews it.
  It prints nothing, and exits before opening any state for ordinary tool calls.

Codex runs new hooks only after you trust them once in its `/hooks` view.
`shelf setup --no-hooks` removes them; `shelf doctor` reports hooks that are
missing or point at a moved binary. In harnesses without hooks, loans keep
their calendar due dates: agents renew with `shelf renew` or `shelf used`.

## Dashboard

`shelf ui` opens a local dashboard that updates live as agents work:

- **Attention**: every loan across your projects that needs you — due soon,
  edited, behind the library, overdue — with one-click renew, update, and a
  diff to review edits before promoting or discarding them.
- **Projects**: borrow skills, see each loan's state and last use. Here and on
  Attention, select several loans to renew, update, keep or return them together.
- **Suggestions**: each project page lists library skills that match what the
  project uses (its `package.json`, `pyproject.toml`, `Cargo.toml` or `go.mod`
  dependencies, and files like `convex/` or `playwright.config.ts`), with the
  reason and session cost, to borrow in one click.
- **Library**: edit SKILL.md and reference files, see revisions and borrowers,
  push updates to chosen projects, and pull reviewed updates from a skill's
  upstream source. The filter searches inside skills too (SKILL.md and reference
  files) and shows the matching lines; click one to open that file. Group skills into sets
  and borrow a whole set at once.
- **Writing skills**: create a skill from the Library page, rename, duplicate
  or archive it from its page, and see a lint strip above the SKILL.md editor
  (description and body tokens, format errors, descriptions that are too long
  or don't say when to use the skill) as you type.
- **Revisions**: open any revision of a skill to read its files, compare it with
  another revision or the latest, and restore it.
- **Find existing skills**: scan for skills copied into projects by hand, see
  which have drifted, and adopt them into the library in one step.
- **Activity**: what your agents did, as a timeline ("codex used api-design in
  billing-api · 2m ago").
- **Insights**: what skills cost at session start per project (user-level
  skills plus borrowed ones), which skills agents actually use (active days and
  a 30-day sparkline each), skills unused for 30 days, and the user-level skills
  in `~/.claude/skills`, `~/.agents/skills`, … that load in every project.
  Token counts are estimates (characters / 4): a skill's name and description
  load at every session start, its full SKILL.md only when it is used.
- **Settings**: hook status per harness, health checks with one-click repair.
- ⌘K to jump anywhere (including skills whose content mentions what you
  type), keyboard navigation (`?` lists shortcuts), dark and light themes.

It listens on 127.0.0.1 only and requires the token in the URL it prints (kept
in `~/.shelf/ui-token`, so bookmarks survive restarts; `--rotate-token` signs
every browser out). Everything is built into the binary: no Node, no CDN, works
offline. The layout adapts to phones and tablets.

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
`--force`. Agents may run the review step, but cannot import from remote
sources unless you set `allowAgentImports`: your library stays the trust
boundary.

## Commands

| Command | |
|---|---|
| `shelf setup [--no-hooks]` | Create `~/.shelf`, install the bundled `shelf` skill and the [hooks](#hooks) |
| `shelf init` | Register the current project |
| `shelf status` | Loans, their states and suggested next steps. Returns overdue skills |
| `shelf guide` | The full guide for agents |
| **Library** | |
| `shelf new <name> -d <description>` | Create a library skill |
| `shelf catalog [terms]` | List library skills with a token estimate (terms match name and description) |
| `shelf search <terms…> [--limit N]` | Find skills by what they say: matching lines from SKILL.md and reference files (quote a phrase) |
| `shelf show <name> [--revision X]` | Print a library skill, or one of its revisions |
| `shelf log <name>` | A skill's revisions and which projects borrow each |
| `shelf restore <name> <revision>` | Make an earlier revision the library's latest again (borrowers update with `propagate`) |
| `shelf set list` | Your skill sets and their skills |
| `shelf set save <name> <skill…> [-d description]` | Create a set, or replace its skills (`@other` includes another set) |
| `shelf set delete <name>` | Delete a set (loans are unaffected) |
| `shelf rename <from> <to>` | Rename a skill (directory and frontmatter `name`), keeping its history; refused while borrowed |
| `shelf duplicate <from> <to>` | Copy a skill to a new name, as a new skill with its own history |
| `shelf archive <name>` | Move a skill to `~/.shelf/archive/` (revisions are kept; move it back to restore); refused while borrowed |
| `shelf lint [name…]` | Check SKILL.md files against the Agent Skills format; exits 1 on errors |
| `shelf loan-days <name> [days] [--reset]` | Show or set a skill's loan length (default: `loanDays`) |
| `shelf diff <name> [--from X] [--to Y]` | Diff `borrowed`, `library`, `project` or a revision |
| `shelf propagate <name> [--project a,b] [--dry-run]` | Push the library's latest revision to every clean borrower |
| `shelf add <source> [--yes] [--force]` | Import skills from git or a directory after a local audit, or link existing ones to it |
| `shelf pull <name> [--yes]` | Update an imported skill from its source |
| `shelf audit [name…]` | Scan library skills for risky content |
| **This project** | |
| `shelf insights [--all]` | Tokens each project loads at session start, and which skills agents actually use (30 days) |
| `shelf suggest [--limit N]` | Library skills matching the project's dependencies and files (e.g. `convex/`, `playwright.config.ts`) |
| `shelf borrow <name…\|@set> [--days N] [--keep] [--follow] [--link]` | Borrow skills (or every skill in a set) into this project |
| `shelf renew <name> [--days N] [--reason …]` | Renew a loan: due the loan length (or N days) from today |
| `shelf used <name…>` | Record a use, which renews the loan (the hooks do this for you) |
| `shelf due <name> <+14d\|-7d\|2026-12-01>` | Move a due date either way |
| `shelf keep <name…> [--off] [--reason …]` | Keep loans: they never expire (for the project's direct dependencies) |
| `shelf return <name> [--force]` | Remove a borrowed skill |
| `shelf update [name…] [--force]` | Update borrowed skills to the library's latest revision |
| `shelf promote <name> [--force] [--propagate]` | Publish a project's edits back to the library (and to other borrowers) |
| `shelf detach <name>` | Stop managing a skill; keep its files |
| `shelf sync` | Return overdue, restore missing copies, update `--follow` loans |
| `shelf targets [--add ids] [--remove ids] [--reset]` | Which harness skill directories this project uses |
| **Everywhere** | |
| `shelf scan [dir]` | Find skill copies under a directory, grouped by name and version |
| `shelf adopt <path…> [--unedited]` | Import existing skills into the library and manage their copies as loans |
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
code per error class. The activity log records which agent acted: Claude Code
and Codex are detected from their environment, other harnesses through the
`AI_AGENT` variable, and `--actor` or `SHELF_ACTOR` override it. `shelf status --json` returns `data.actions`: runnable
next steps. With the hooks installed agents don't even need that call: the
session-start note tells them when to act. The bundled skill is about ten
lines; the details live in `shelf guide`.

## Configuration

`~/.shelf/config.json` (created by `shelf setup`):

| Key | Default | |
|---|---|---|
| `loanDays` | `30` | Loan length, and how far a use or renewal moves the due date (a skill can override it with `shelf loan-days`) |
| `maxLoanDays` | `90` | Due dates can't be set further out than this |
| `dueSoonDays` | `7` | When a loan counts as `due-soon` |
| `targets` | `[".agents/skills", ".claude/skills"]` | Where borrowed skills are written (a project can override with `shelf targets`) |
| `mode` | `"copy"` | `"link"`: one copy per project, other targets symlink to it |
| `allowAgentImports` | `false` | Let agents run `shelf add` / `shelf pull` from remote sources |
| `hooks` | `true` | Whether `shelf setup` installs the [hooks](#hooks) (set by `--no-hooks`) |

Set `SHELF_HOME` to keep shelf's state elsewhere.

See [docs/architecture.md](docs/architecture.md) for the design.

## License

[MIT](LICENSE)
