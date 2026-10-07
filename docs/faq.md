# FAQ

Short answers to common questions about shelf: how it relates to skill registries and user-level skill folders, teams, multiple machines, what agents may do, what it costs, and what happens to your files.

## How is this different from putting skills in ~/.claude/skills?

A user-level skill folder works in one harness and loads into every project, relevant or not, forever. shelf keeps skills in one library, copies them only into projects that borrow them, writes them where every harness looks, and returns them when they stop being used. You also get versions, diffs, and a way to push an improvement to every project.

## Is shelf a skill registry or package manager?

No. There is no central index and nothing to publish to. Your library is a folder on your machine. You can import skills from any git repository or folder with `shelf add`, after a local audit and your explicit `--yes`, and update them later with `shelf pull`.

## Does it work with my harness?

Any harness that reads `.agents/skills` or `.claude/skills` works out of the box: Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, OpenCode, Amp, Goose, Cline, Roo Code, Factory Droid, Windsurf / Devin. Others, such as Kiro, need their directory added with `shelf targets --add <id>`. Renew-on-use hooks exist for Claude Code and Codex; elsewhere agents run `shelf used`. See [Harnesses](harnesses.md).

## Do I need hooks?

No, but they are what makes loans maintain themselves. Without hooks, loans keep their calendar due dates, so a skill in daily use still comes due unless someone renews it or runs `shelf used`.

## What does it cost in context?

The bundled `shelf` skill's description is about 66 tokens per session. Hooks add nothing to a healthy project's context; when something needs attention, they add one line. Each borrowed skill adds its name and description to every session, which is why loans expire. `shelf insights` shows the numbers.

## Can my team share a library?

shelf is single-user: the library and loans live in your home directory. What a project holds travels in its lockfile: a teammate with shelf and the same skills in their library gets the same loans, kept skills and targets. To share skills themselves, keep them in a git repository and have each person `shelf add` and `shelf pull` them.

## I use several machines. How do I keep them in sync?

Each machine has its own library, loans and activity. Commit project lockfiles, so each machine recognises the same projects and loans. For the library, either keep skills in a git repository that every machine `shelf add`s from and `shelf pull`s, or sync `~/.shelf/library` yourself; shelf records a revision for whatever changed the next time it runs.

## Will shelf ever delete my edits?

No. Anything that would discard local edits in a project (returning, updating, expiring, removing a target) refuses unless you pass `--force`. Overdue loans with edits stay. Library revisions are never deleted, archived skills are moved, not deleted, and `shelf restore` records unsaved library edits before it replaces anything.

## Should I commit the copies in .claude/skills and .agents/skills?

Commit the lockfile. Committing the copies is optional: it helps people who clone without shelf, and costs repository size. See [Lockfile](lockfile.md#commit-it).

## Can agents break my library?

Agents can borrow, renew, return, update, promote and keep, all recorded in the activity log with their name. The guide tells them to change the library (adopt, rename, archive, restore, sets) only when you ask. The one enforced rule is that agents can't import skills from git sources unless you set `allowAgentImports`. Promoted edits can be undone with `shelf restore`, since every revision is kept.

## Does shelf send anything over the network?

No. It works offline. The only network access is `git clone` when you `shelf add` or `shelf pull` from a git source. The dashboard listens on 127.0.0.1 only.

## Why copies instead of symlinks?

Symlinked skills are unreliable in several harnesses and across the WSL/Windows boundary. Copies work everywhere, and shelf tracks them by hash. Link mode (`--link`) is there for projects where symlinks work.

## Why doesn't the lockfile have due dates?

So renewing never changes a committed file. Due dates are personal and change often; they live in the database. See [Lockfile](lockfile.md#why-no-timestamps).

## How do I stop using shelf in a project?

`shelf detach <name>` for skills you want to keep as plain files, `shelf return <name>` for the rest, then delete `.agents/shelf.lock.json`. See [Installation: uninstalling](installation.md#uninstalling).
