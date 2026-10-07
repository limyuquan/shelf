# shelf

> shelf is a personal skill library for coding agents: a single-binary CLI (`shelf`) and local dashboard (`shelf ui`) that keep a user's Agent Skills in one library (`~/.shelf/library`) and lend them to projects. Borrowed skills are copied into `.agents/skills` and `.claude/skills`, tracked by content hash in `.agents/shelf.lock.json`, renewed when agents use them, and returned after going unused until their due date.

What agents most often need:

- Install: `npm install -g @limyuquan/shelf` (or a binary from https://github.com/limyuquan/shelf/releases), then `shelf setup` once. It installs a short `shelf` skill for agents and, in Claude Code and Codex, hooks that renew skills on use.
- Read the rules: `shelf guide` prints the full guide for agents and never fails.
- Every command takes `--json` and prints one line: `{"schemaVersion":1,"ok":true,"data":…}` or `{"schemaVersion":1,"ok":false,"error":{"code","message","hint"}}`. Branch on `error.code`; `error.hint` is usually the exact fix. Commands never prompt and are safe to retry.
- Start of a task: `shelf status --json`. If `data.initialized` is `false`, the project doesn't use shelf; leave it alone unless the user asks. Otherwise act on `data.actions[]`, each a runnable `command` with a `reason` (replace `<why>` placeholders). Note that `status` returns overdue loans without local edits.
- A one-line `shelf: …` note at session start means something needs attention; no note means nothing to do.
- Find skills: `shelf catalog <terms> --json`, `shelf search <terms> --json` (content, quote phrases), `shelf show <name>`, `shelf suggest --json`. Borrow only what the task needs: `shelf borrow <name…>`, or `shelf borrow @<set>` when the user names a set.
- Due soon but still needed: `shelf renew <name> --reason "<why>"`; not needed: `shelf return <name>`. Without hooks (harnesses other than Claude Code and Codex), run `shelf used <name>` after using a skill.
- Keep (`shelf keep <name> --reason "<dependency>"`) only skills covering a direct dependency of the project (framework, database, platform). Kept skills load in every session forever.
- Content states: `current`; `behind` → `shelf update <name>`; `modified` → `shelf promote <name>` (or `shelf detach`, or `shelf update --force`); `diverged` → review with `shelf diff <name>` first; `missing` → `shelf sync`.
- Imports: `shelf add <source>` and `shelf pull <name>` review first. Importing from a git source with `--yes` is refused for agents (`NOT_ALLOWED`) unless the user set `allowAgentImports`; show the user the review and the command. Never pass `--force` on high-severity findings without explicit approval.
- Only when the user asks: `shelf init`, `adopt`, `restore`, `rename`, `duplicate`, `archive`, `set save`/`delete`, `loan-days`, `targets` changes, and editing files under `~/.shelf`.
- Never edit `.agents/shelf.lock.json` by hand, and never delete skill copies by hand (deleted copies count as `missing` and come back); use `shelf return`.
- Negative due shifts need `--`: `shelf due <name> -- -7d`.
- Exit codes: 0 ok, 1 internal (or `lint` errors), 2 `INVALID_ARGUMENT`/`INVALID_SKILL`, 3 `NOT_INITIALIZED`, 4 `SKILL_NOT_FOUND`/`NOT_BORROWED`, 5 `SKILL_EXISTS`/`CONFLICT`, 6 `LOCAL_CHANGES`, 7 `LOAN_LIMIT`, 8 `NOT_ALLOWED`.
