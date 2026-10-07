# Hooks

The harness hooks that `shelf setup` installs in Claude Code and Codex: what they do, what they cost, the exact entries they add, trusting them in Codex, what to do in harnesses without hooks, and how to check them.

## What they do

Two hooks make loans work without anyone thinking about them:

| Hook | Runs on | Does |
|---|---|---|
| `shelf hook session-start` | Session start | Syncs the project (returns overdue skills, restores missing copies, updates `--follow` loans) and prints one `shelf: …` line only when something needs attention. |
| `shelf hook skill-use` | After tool calls, and when you submit a prompt | Recognises a borrowed skill being used and renews its loan. Prints nothing. |

A use is recognised when:

- the Skill tool is called with a borrowed skill's name;
- a tool's input mentions a path inside a borrowed copy, such as a Read of `.agents/skills/pdf-tools/SKILL.md` or `cat .claude/skills/pdf-tools/reference.md` in a shell command;
- your prompt invokes a borrowed skill as `/pdf-tools` or `$pdf-tools`.

Each recognised use moves the loan's due date to its loan length from now (30 days by default), so a loan only comes due after going unused. See [Concepts](concepts.md#renew-on-use).

## What they cost

Hook output is the only thing hooks add to an agent's context.

- `skill-use` never prints. It also exits before opening any file or database for ordinary tool calls (edits, searches, commands that don't mention `skills`), so it adds almost no time to a turn.
- `session-start` prints nothing for a healthy project. When something needs attention, it prints one line, with at most four skill names per item:

```
shelf: due soon unless used: git-hygiene (4d) — `shelf renew <name>` to keep, `shelf return <name>` if unneeded; edited here: react-best-practices — `shelf promote <name>` publishes to the library. Details: `shelf status`.
```

The line can report, in this order: skills just returned after going unused, skills due soon, overdue skills kept because of local edits, skills edited here, skills edited here and in the library, and skills with library updates. The bundled skill tells agents to act on it.

Hooks never fail the agent's turn: errors go to stderr (the harness's debug log) and the exit code is always 0. Outside a shelf project they do nothing.

## Install

```console
$ shelf setup
…
Hooks (renew skills when used, report loans needing attention):
  Claude Code: hooks installed (/home/me/.claude/settings.json)
  Codex: hooks installed (/home/me/.codex/hooks.json)
Codex runs new hooks only after you trust them: open `/hooks` in Codex once.
```

`shelf setup` adds the hooks for each harness whose config directory exists: `~/.claude` (or `$CLAUDE_CONFIG_DIR`) and `~/.codex` (or `$CODEX_HOME`). If neither exists, it says so; run `shelf setup` again after installing one.

Your other settings and hooks are kept. Hook entries are recognised by their command (`shelf hook …`), so running `shelf setup` again replaces them, for example after the binary moved, and never duplicates them.

### Claude Code

Added to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "/home/me/.local/bin/shelf hook session-start --harness claude-code", "timeout": 30 }] }
    ],
    "PostToolUse": [
      { "matcher": "Skill|Read|Bash", "hooks": [{ "type": "command", "command": "/home/me/.local/bin/shelf hook skill-use --harness claude-code", "timeout": 10 }] }
    ],
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "/home/me/.local/bin/shelf hook skill-use --harness claude-code", "timeout": 10 }] }
    ]
  }
}
```

### Codex

Added to `~/.codex/hooks.json`. The same events, but `PostToolUse` has no matcher, because Codex reads skills with shell commands whose tool names vary:

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "/home/me/.local/bin/shelf hook session-start --harness codex", "timeout": 30 }] }
    ],
    "PostToolUse": [
      { "hooks": [{ "type": "command", "command": "/home/me/.local/bin/shelf hook skill-use --harness codex", "timeout": 10 }] }
    ],
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "/home/me/.local/bin/shelf hook skill-use --harness codex", "timeout": 10 }] }
    ]
  }
}
```

**Codex runs new hooks only after you trust them.** Open `/hooks` in Codex once and trust shelf's entries. Until then, Codex loans keep their calendar due dates.

### The command path

The hook command is the absolute path of the running binary (quoted if it contains spaces), because hooks may run without your shell's `PATH`, for example from a desktop app. With npm, that is the platform binary inside the npm package. If you move or replace the binary at another path, run `shelf setup` again or `shelf doctor --fix`.

### Settings files shelf can't read

If `settings.json` or `hooks.json` exists but isn't a JSON object, shelf leaves it alone and reports the harness as `skipped`. Fix the file, or add the entries above by hand, then check with `shelf doctor`.

## Remove

```console
$ shelf setup --no-hooks
…
Hooks:
  Claude Code: hooks removed (/home/me/.claude/settings.json)
  Codex: hooks removed (/home/me/.codex/hooks.json)
```

This removes only shelf's entries and sets `"hooks": false` in the config, so `shelf doctor` stops expecting them. `shelf setup` without the flag turns them back on.

## Harnesses without hooks

Cursor, Gemini CLI, Copilot and the other harnesses read borrowed skills from `.agents/skills` like any other, but shelf has no hooks for them. There:

- Loans keep their calendar due dates. Nothing renews them on use.
- Agents run `shelf used <name>` after using a borrowed skill, which renews it like a hook would. The guide tells them to.
- Agents can run `shelf status --json` at the start of a task to see what needs attention, since no session-start note arrives.
- Overdue skills are returned when someone runs `shelf status` or `shelf sync` in the project, or by a scheduled `shelf sweep` (see [Automation](automation.md)).

## Check

```console
$ shelf doctor
…
ok    hooks: Hooks renew loans on use in every installed harness
…
```

`shelf doctor` warns when a harness's hooks are missing, point at another binary, or its settings file isn't valid JSON. `shelf doctor --fix` reinstalls them. The dashboard's **Settings** page shows each harness's hook status (Installed, Not installed, Outdated, Settings unreadable, Not installed on this machine) and has a **Repair** button.

## Related

- [`shelf setup`](cli/setup.md), [`shelf hook`](cli/hook.md), [`shelf used`](cli/used.md), [`shelf doctor`](cli/doctor.md)
- [Agents](agents.md)
