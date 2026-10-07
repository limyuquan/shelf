# Introduction

What shelf is, the problems it solves, and the model behind it: one library of your own skills, lent to projects with due dates, renewed when agents use them.

## What it is

shelf is a command-line tool (`shelf`) and a local dashboard (`shelf ui`) for managing [Agent Skills](https://agentskills.io): folders with a `SKILL.md` that teach a coding agent how to do something.

You keep every skill you write or trust in one library, `~/.shelf/library`. A project **borrows** the skills it needs. shelf copies them into the project's skill directories (`.agents/skills` and `.claude/skills` by default), records what it copied in a lockfile, and gives each loan a **due date**. When an agent uses a borrowed skill, its due date moves out again. When a skill goes unused until its due date, shelf returns it.

It is a single binary. It needs no Node, works offline, and the dashboard listens on 127.0.0.1 only.

## Why

- **Copy-pasted skills drift.** The same skill lives in ten repositories at ten different versions, and nobody knows which one is current.
- **Global skill folders are harness-specific and load everywhere.** A skill in `~/.claude/skills` is invisible to Codex or Cursor, and is loaded into every project whether it is relevant or not. Every loaded skill costs context at the start of every session.
- **Skill registries are a supply-chain risk.** They treat your own skills as second-class, and installing from them puts someone else's instructions in front of your agent.

shelf makes your own library the source of truth and the trust boundary. Agents borrow only from it, and anything that comes from outside is audited and needs your explicit `--yes`.

## The model in one picture

```
~/.shelf/library/                         your project
  pdf-tools/     ── borrow ──────────▶     .agents/skills/pdf-tools/
  api-design/       (one revision,         .claude/skills/pdf-tools/
  git-hygiene/       until a due date)     .agents/shelf.lock.json
       ▲                                          │
       └────────────── promote ◀──── edits ───────┘
       ─────────────── update / propagate ───────▶
```

| Thing | Where it lives | What it is |
|---|---|---|
| Library | `~/.shelf/library/<skill>/` | The editable copy of each skill. Edit it with any editor. |
| Revision | `~/.shelf/objects/<hash>/` | An immutable snapshot of a skill, named by its content hash. Every change is a new revision. |
| Loan | `~/.shelf/shelf.db` | A project borrowing one revision of a skill until a due date. |
| Project copy | `<project>/<target>/<skill>/` | The files the harness reads, one copy per target directory. |
| Lockfile | `<project>/.agents/shelf.lock.json` | Which skills shelf manages in the project, at which revision. No timestamps. |

Three rules follow from this model:

1. **Using a skill renews it.** Harness hooks see a borrowed skill being used and move its due date to the skill's loan length from now (30 days by default).
2. **Unused skills are returned.** An overdue loan is returned at the next `shelf status`, `shelf sync`, `shelf sweep` or session start, unless the project copy has local edits, which shelf never deletes.
3. **Changes move only when you say so.** Edits flow from a project to the library with `shelf promote`, and from the library to projects with `shelf update` or `shelf propagate` (or automatically for loans borrowed with `--follow`).

[Concepts](concepts.md) defines every term in detail.

## Who it is for

shelf is for a developer who uses coding agents across several projects and has, or wants, a personal set of skills. It is single-user and per machine: the library and the loan database live in your home directory, and the lockfile carries what a project needs to other clones.

It is equally meant to be operated by agents. Every command has `--json`, never prompts and is safe to retry. The bundled `shelf` skill tells agents that shelf exists, and `shelf guide` gives them the full rules. See [Agents](agents.md).

## Next

- [Installation](installation.md)
- [Quickstart](quickstart.md): five minutes from install to a borrowed skill
- [Concepts](concepts.md)
