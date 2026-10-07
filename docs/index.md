# shelf documentation

shelf is a personal skill library for coding agents. Keep your Agent Skills in one library, borrow them into the projects that need them, and let loans expire so stale skills don't pile up.

```console
$ shelf borrow pdf-tools api-design
Borrowed pdf-tools (due 2026-11-06) → .agents/skills, .claude/skills
Borrowed api-design (due 2026-11-06) → .agents/skills, .claude/skills
```

Each borrowed skill is copied into the project for every harness (Claude Code, Codex, Cursor, Gemini CLI, Copilot and others), tracked by content hash in a lockfile, and given a due date. When an agent uses the skill, the due date moves out again. Skills nobody uses are returned.

## Quick start

```sh
npm install -g @limyuquan/shelf   # or download a binary from the releases page
shelf setup                       # creates ~/.shelf, installs the shelf skill and hooks
cd ~/code/storefront
shelf init                        # this project now uses shelf
shelf new pdf-tools -d "Extract text and tables from PDFs. Use when a task involves PDFs."
shelf borrow pdf-tools
shelf status
shelf ui                          # the dashboard
```

The [quickstart](quickstart.md) walks through the same steps with real output.

## Where to go next

| If you want to | Read |
|---|---|
| Understand what shelf is and the words it uses | [Introduction](introduction.md), [Concepts](concepts.md) |
| Install it | [Installation](installation.md) |
| Borrow, renew and return skills | [Borrowing](borrowing.md) |
| Bring the skills you already have into shelf | [Migrating](migrating.md) |
| Edit a skill once and update every project | [Keeping skills current](keeping-skills-current.md) |
| Write good skills | [Writing skills](writing-skills.md) |
| Let agents run shelf on their own | [Agents](agents.md), [Hooks](hooks.md) |
| Look up a command, flag, config key or error code | [CLI reference](cli/index.md), [Configuration](configuration.md), [Errors](errors.md) |

Agents can read every page as Markdown: the site serves each page at its URL with `.md`, and [llms.txt](https://limyuquan.github.io/shelf/llms.txt) lists them all.
