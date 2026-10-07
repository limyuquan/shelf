# Agents

How coding agents use shelf on their own: how they learn about it, the JSON envelope and exit codes, how shelf knows which agent acted, status actions and session-start notes, and the rules agents follow.

shelf is built to be operated by agents as much as by you. Every command has `--json`, never prompts, and is safe to retry. Errors carry a `hint` with the command that fixes them.

## How agents learn about shelf

1. **The bundled skill.** `shelf setup` installs a short `shelf` skill in your user-level skill folders, so agents in every project know shelf exists and when to use it. Its description costs about 66 tokens per session:

   ```markdown
   ---
   name: shelf
   description: Manage this project's agent skills from the user's personal skill library with the `shelf` CLI (borrow, renew, return, update, promote). Use when a `shelf:` note appears, when the user asks about skills, or when a task needs a skill the project does not have.
   ---

   Borrowed skills renew automatically when used and are returned after going unused. A `shelf:` note at session start means something needs attention: act on it.

   - Need a capability? `shelf catalog <terms> --json`, check it with `shelf show <name>`, then `shelf borrow <name>`.
   - Due soon but still needed: `shelf renew <name> --reason "<why>"`. No longer needed: `shelf return <name>`.
   - Improved a borrowed skill? `shelf promote <name>` publishes it to the library. Library changed? `shelf update <name>`.
   - Never hand-edit or delete skill copies to change them everywhere; shelf tracks them by hash.

   `shelf status --json` lists every loan with next steps. Errors include a `hint` with the fix. Full guide: `shelf guide`.
   ```

2. **The guide.** `shelf guide` prints the full rules for agents (about 140 lines): loan states, choosing skills, due dates, keeping, changing skills everywhere, existing skills, imports and harness directories. It needs no shelf home or project, so it never fails. `shelf guide --json` wraps it in the envelope as `data.guide`.

3. **The session-start note.** In Claude Code and Codex, the [hooks](hooks.md) add one `shelf: …` line to the agent's context when something needs attention. No note means nothing to do.

4. **These docs.** Every page is available as Markdown, and [llms.txt](https://limyuquan.github.io/shelf/llms.txt) indexes them for agents.

## The JSON envelope

With `--json`, every command prints exactly one line on stdout:

```json
{"schemaVersion":1,"ok":true,"data":{"skills":[{"skill":"pdf-tools","status":"borrowed","revision":"sha256:dca5f929e749b602869f964b944ab1c8567353094f413d0f53dabe7dfa015b67","dueAt":"2026-11-06T05:51:38.125Z","targets":[".agents/skills",".claude/skills"],"mode":"copy","kept":false}]}}
```

```json
{"schemaVersion":1,"ok":false,"error":{"code":"NOT_BORROWED","message":"\"nope\" is not borrowed by storefront","hint":"Run `shelf borrow nope` first"}}
```

- `schemaVersion` is `1`. It changes only when the envelope or a command's `data` shape changes incompatibly.
- Dates are ISO 8601 strings in UTC.
- `hint` is a string or `null`.
- Usage errors (an unknown command, a missing argument) also arrive as an envelope with code `INVALID_ARGUMENT` when `--json` is given.

Each command's page in the [CLI reference](cli/index.md) shows its `data` shape.

## Exit codes

| Exit | Error codes |
|---|---|
| 0 | Success |
| 1 | `INTERNAL` (an unexpected error), and `shelf lint` when a skill has errors |
| 2 | `INVALID_ARGUMENT`, `INVALID_SKILL` |
| 3 | `NOT_INITIALIZED` |
| 4 | `SKILL_NOT_FOUND`, `NOT_BORROWED` |
| 5 | `SKILL_EXISTS`, `CONFLICT` |
| 6 | `LOCAL_CHANGES` |
| 7 | `LOAN_LIMIT` |
| 8 | `NOT_ALLOWED` |

Branch on `error.code` rather than the exit code; several codes share one exit code. See [Errors](errors.md) for what each means and how to resolve it.

## Status and actions

```sh
shelf status --json
```

| Field | Meaning |
|---|---|
| `data.initialized` | `false` if the project doesn't use shelf. Leave it alone unless the user asks to start using shelf there; there is deliberately no `shelf init` action. |
| `data.loans[]` | Every loan: `skill`, `content`, `due`, `dueAt`, `daysLeft`, `lastUsedAt`, `kept`, `loanDays`, `policy`, `revision`, `latestRevision`, `targets`. |
| `data.expired[]` | Skills this call just returned because they were overdue. |
| `data.actions[]` | Next steps, most urgent first: `{ "command": "shelf update pdf-tools", "reason": "The library has a newer revision of pdf-tools" }`. |
| `data.warnings[]` | Library problems and lockfile entries this machine's library doesn't have. |

Each action's `command` is runnable as-is, except `<why>` placeholders, which the agent replaces with a real reason:

| Loan | Action |
|---|---|
| `missing` | `shelf sync` |
| `diverged` | `shelf show <name>` (review, then promote with `--force` or update with `--force`) |
| `modified` | `shelf promote <name>` (or detach, or update with `--force`) |
| `behind`, pinned | `shelf update <name>` |
| `behind`, follow | `shelf sync` |
| overdue, no edits | `shelf sync` (returns it) |
| overdue, edited | `shelf detach <name>` (or promote) |
| `due-soon` | `shelf renew <name> --reason "<why>"` (or return it) |

`shelf status` itself returns overdue loans without local edits, so it is not read-only. To look without changing anything, read the dashboard or `shelf projects`.

## Which agent acted

The activity log records an actor for every change. shelf picks it in this order:

1. `--actor <name>`
2. `SHELF_ACTOR`
3. `CODEX_THREAD_ID` or `CODEX_SESSION_ID` set: `agent:codex`
4. `CLAUDECODE` set: `agent:claude-code`
5. `AI_AGENT` set: `agent:` plus its first word, lowercased (`claude-code_2-1-289_agent` becomes `agent:claude-code`)
6. A terminal on stdin: `user`; otherwise `unknown`

Codex is checked before Claude Code because harnesses pass their environment on: a Codex session started from Claude Code sees both, and Codex is the one running shelf. Hooks record `agent:<harness>`.

Actors starting with `agent:` may not import skills from git sources unless the user enables `allowAgentImports` (see [Importing skills](importing-skills.md#what-agents-may-do)).

## The rules agents follow

The guide gives agents these rules. They are the contract between you and your agents:

- **Borrow only what the task needs.** Every skill costs context in every session. Check `shelf catalog`, `shelf search` or `shelf show` first.
- **Renew with a reason, or return.** A `due-soon` skill has gone unused. `shelf renew <name> --reason "<why>"` if the project still needs it, else `shelf return <name>`. The reason appears in the activity log.
- **Record uses where there are no hooks.** `shelf used <name>` after using a skill.
- **Keep only direct dependencies.** `shelf keep <name> --reason "<dependency>"` only for skills covering the framework, database or platform the project is built on (Convex skills in a project depending on `convex`). Never "just in case".
- **Promote improvements.** An improved borrowed skill goes back with `shelf promote <name>`; `--propagate` updates other projects, skipping copies with their own edits.
- **Imports need the user.** Agents may run the review step of `shelf add` and `shelf pull`, and link existing skills to a source. Importing from a remote source with `--yes` is refused unless the user enabled it: show the user the review and the exact command. Never pass `--force` on high-severity findings without explicit approval.
- **Only when asked:** `shelf init` in a new project, `shelf adopt`, `shelf restore`, `shelf rename`, `shelf duplicate`, `shelf archive`, `shelf set save` / `delete`, `shelf loan-days`, `shelf targets` changes, and editing library files under `~/.shelf`.
- **Never edit the lockfile by hand, and never delete skill copies by hand.** Use `shelf return`; deleted copies count as `missing` and come back.

## Session-start notes

The note is one line. Each item names the skills and the command to run:

```
shelf: returned after going unused: pdf-tools (`shelf borrow <name>` to get one back); library has updates: react-best-practices — `shelf update <name>`. Details: `shelf status`.
```

| Item | Agent's move |
|---|---|
| returned after going unused | Borrow again only if the current task needs it. |
| due soon unless used | Renew with a reason if still needed, else return. |
| overdue, not returned because of local edits | Promote or detach. |
| edited here | Promote, if the edits are improvements. |
| edited here and in the library | Review with `shelf diff` before choosing. |
| library has updates | `shelf update <name>`. |

## llms.txt

The docs site publishes [llms.txt](https://limyuquan.github.io/shelf/llms.txt): a short summary of shelf with the facts agents need most, and a list of every docs page as Markdown. [llms-full.txt](https://limyuquan.github.io/shelf/llms-full.txt) has every page in one file. Point an agent at either when it needs to know shelf beyond `shelf guide`.

## Related

- [`shelf guide`](cli/guide.md), [`shelf status`](cli/status.md)
- [Hooks](hooks.md), [Errors](errors.md), [Environment](environment.md)
- [Automation](automation.md)
