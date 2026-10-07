# Quickstart

Five minutes from a fresh install to a skill borrowed into a project: set up, create or adopt a skill, borrow it, check the project's status and open the dashboard.

This page assumes shelf is [installed](installation.md). The examples use a project called `storefront`; use any project of yours.

## 1. Set up

```console
$ shelf setup
Shelf home: /home/me/.shelf
Library:    /home/me/.shelf/library
Installed the shelf skill at:
  /home/me/.agents/skills/shelf/SKILL.md
  /home/me/.claude/skills/shelf/SKILL.md

Hooks (renew skills when used, report loans needing attention):
  Claude Code: hooks installed (/home/me/.claude/settings.json)
  Codex: hooks installed (/home/me/.codex/hooks.json)
Codex runs new hooks only after you trust them: open `/hooks` in Codex once.
```

## 2. Put a skill in the library

Create a new skill:

```console
$ shelf new pdf-tools -d "Extract text, tables and form fields from PDFs, and fill or merge PDF files. Use when a task involves reading or producing PDFs."
Created pdf-tools at /home/me/.shelf/library/pdf-tools
Edit its files with any editor; shelf records each change as a new revision.
```

Open `~/.shelf/library/pdf-tools/SKILL.md` in your editor and write the instructions. shelf notices the change the next time any command reads the library and records it as a new revision. Check the format with:

```console
$ shelf lint pdf-tools
pdf-tools  ~32 description + ~17 body tokens  ok
```

Already have skills copied into your projects? Adopt them instead of starting over:

```sh
shelf scan ~/code                                   # find every copy, grouped by name and version
shelf adopt ~/code/storefront/.claude/skills/review  # import one into the library
```

See [Migrating](migrating.md) for drifted copies and the dashboard's **Find existing skills**.

## 3. Borrow it into a project

```console
$ cd ~/code/storefront
$ shelf init
Initialized shelf in /home/me/code/storefront

$ shelf borrow pdf-tools
Borrowed pdf-tools (due 2026-11-06) → .agents/skills, .claude/skills
```

`shelf init` creates `.agents/shelf.lock.json`. `shelf borrow` copies the skill into both default skill directories, so Claude Code (`.claude/skills`) and Codex, Cursor, Gemini CLI, Copilot and the rest (`.agents/skills`) all find it. Commit the lockfile.

## 4. Check the project

```console
$ shelf status
storefront  /home/me/code/storefront

SKILL      CONTENT  DUE                   USED   POLICY  REVISION
pdf-tools  current  2026-11-06  30d left  never  pinned  ddad27dd34
```

Each loan has a content state (`current` here), a due date, its last use, a policy and the revision it holds. When something needs doing, `shelf status` ends with **Next steps**: exact commands with the reason for each.

From now on you rarely need to do anything. When an agent uses `pdf-tools`, the hooks move its due date to 30 days from that day. If nobody uses it for 30 days, the next session start returns it. If a session starts while something needs attention, the agent sees one line like this one:

```
shelf: due soon unless used: git-hygiene (4d) — `shelf renew <name>` to keep, `shelf return <name>` if unneeded. Details: `shelf status`.
```

## 5. Open the dashboard

```console
$ shelf ui
shelf dashboard: http://127.0.0.1:4222/?token=<token>
Ctrl-C to stop.
```

The browser opens on **Attention**: every loan across your projects that needs you. Projects, the library editor, revisions, activity and insights are one click away. See [Dashboard](dashboard.md).

## Next

- [Concepts](concepts.md): content states, due dates, keep, sets and the lockfile
- [Borrowing](borrowing.md): renew, return, due dates and `--follow`
- [Keeping skills current](keeping-skills-current.md): edit once, update everywhere
- [Agents](agents.md): what your agents do with shelf on their own
