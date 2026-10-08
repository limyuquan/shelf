# Changelog

What has shipped in shelf, newest first. Releases are on [GitHub](https://github.com/limyuquan/shelf/releases) and npm (`@limyuquan/shelf`).

## 0.5.0

The first public release: binaries for macOS, Linux and Windows, and the npm package. Everything below is in it.

### Fixes

- `shelf due <name> -7d` works without `--`; usage errors exit 2 with or without `--json`.
- `shelf lint` reports skills that fail to load and invalid directory names, and exits 1.
- `shelf renew` counts from today, like renew on use, so renewing twice no longer adds up towards `maxLoanDays`.
- `shelf new` and `shelf add` validate before writing anything, and refuse archived skills' names.
- `shelf ui` on a port in use is a `CONFLICT` with a hint instead of an internal error.
- Dashboard: the Overdue row says why a loan is still there; "Return and delete edits" asks first; paths under your home directory show as `~/…`; long diff lines wrap.

### Since the 0.4 milestone

- **`shelf insights`**: tokens each project loads at session start, and which skills agents used in the last 30 days.
- **Actor detection**: Codex, and any harness that sets `AI_AGENT`, are recorded as the acting agent.
- **Agents may keep loans**, limited by the guide to skills covering a project's direct dependencies, with a `--reason`.
- **Dashboard bulk actions**: renew, update, keep or return several loans at once.
- **Dashboard port**: a second `shelf ui` on a port in use fails instead of sharing it.
- **Writing skills**: `shelf new` plus `rename`, `duplicate`, `archive` and `lint`; the dashboard gets a lint strip above the SKILL.md editor.
- **Sets**: `shelf set save/list/delete` and `shelf borrow @set`.
- **Live updates** in the dashboard as agents and the CLI work.
- **Search inside skills**: `shelf search`, the Library filter and ⌘K look in SKILL.md and reference files.
- **Suggestions**: `shelf suggest` and project pages match library skills to a project's dependencies and files.
- **Keep and loan length**: `shelf keep` for loans that never expire (recorded in the lockfile), and `shelf loan-days` for per-skill loan lengths.
- **Find existing skills** in the dashboard: scan and adopt with checkboxes.
- **Revision history**: view any revision, compare two, and `shelf restore`.
- **Insights page** in the dashboard: context budget and skill usage.
- **Dashboard rebuilt** as a React app over a typed API, with borrow, promote, pull, a file editor, settings, keyboard navigation and a mobile layout. Remote access stays outside shelf: the server listens on 127.0.0.1 only.
- **Renew on use**: `shelf setup` installs Claude Code and Codex hooks that renew a loan when its skill is used and report loans needing attention at session start.
- `shelf status` no longer suggests `shelf init` to agents in projects that don't use shelf.

### 0.4 milestone

- `shelf add` and `shelf pull`: import skills from git or a directory after a local audit, and update them later.
- `shelf audit`.
- Link mode (`--link`, `"mode": "link"`).
- Project targets (`shelf targets`) for harnesses beyond `.agents/skills` and `.claude/skills`.
- Release builds for macOS, Linux and Windows, and npm packages.

### 0.3 milestone

- The first local dashboard, `shelf ui`.

### 0.2 milestone

- `shelf scan` and `shelf adopt` for existing skill copies.
- `shelf log`, `shelf diff`, `shelf propagate`, `shelf sweep` and `shelf doctor`.

### 0.1 milestone

- The library, content-addressed revisions, loans with due dates, the lockfile, `shelf status` and `shelf sync`.
