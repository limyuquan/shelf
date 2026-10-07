# Troubleshooting

How to diagnose shelf with `shelf doctor`, and fixes for the problems people run into most: skills that don't renew, skills agents can't see, copies that come back, loans that won't expire, lockfile warnings, install problems and dashboard access.

## Start with shelf doctor

```sh
shelf doctor
```

It checks library skills, the bundled skill, hooks, registered projects, interrupted writes and the object store, and `shelf doctor --fix` repairs what it safely can. See [`shelf doctor`](cli/doctor.md). In a project, `shelf status` shows each loan's state and the next step.

## Loans

### Skills don't renew when agents use them

The hooks record uses. Check them:

- `shelf doctor` warns if Claude Code's or Codex's hooks are missing or point at another binary (after an upgrade or a move). `shelf doctor --fix` or `shelf setup` reinstalls them.
- **Codex** runs new hooks only after you trust them: open `/hooks` in Codex once.
- `shelf setup --no-hooks` turned them off (`hooks: false` in the config). Run `shelf setup`.
- Other harnesses (Cursor, Gemini CLI, Copilot, …) have no hooks. Agents there must run `shelf used <name>`; see [Hooks](hooks.md#harnesses-without-hooks).
- A use is recognised only through the Skill tool, a tool reading a file inside the borrowed copy, or a `/name` prompt. An agent that follows a skill it remembers, without opening it, doesn't renew it.

### An agent can't see a borrowed skill

- Check the harness reads one of the project's targets. `shelf targets` lists harnesses and their directories; Kiro, for example, needs `shelf targets --add kiro`. See [Harnesses](harnesses.md).
- Gemini CLI reads `.agents/skills` only in trusted workspaces.
- Some harnesses discover skills when a session starts. Start a new session after borrowing.
- `shelf status` shows `missing`? Run `shelf sync`.

### A skill I deleted came back

Deleting a copy doesn't return it: shelf sees the loan as `missing` and restores it at the next sync or session start. Use `shelf return <name>`.

### An overdue skill wasn't returned

shelf never deletes local edits. An overdue loan whose copy is `modified` or `diverged` stays until you `shelf promote` (publish the edits), `shelf detach` (keep them, unmanaged) or `shelf return --force` (discard them). Kept loans never come due.

Also, expiry happens when something runs in the project: `shelf status`, `shelf sync`, a session start with hooks. Schedule `shelf sweep` to return overdue loans everywhere ([Automation](automation.md)).

### borrow says the directory "already exists and is not managed by shelf"

A target already has a folder with the skill's name that shelf didn't put there:

```console
$ shelf borrow pdf-tools
error: /home/me/code/storefront/.claude/skills/pdf-tools already exists and is not managed by shelf
hint: Move or delete it first, or import it into the library as a new skill
```

Adopt it instead, which turns it into a loan without losing anything: `shelf adopt .claude/skills/pdf-tools`. See [Migrating](migrating.md).

### renew fails with LOAN_LIMIT

`renew` counts from today, and no due date can be more than `maxLoanDays` (90) from now, so `--days` above the limit fails. Renew by fewer days (`--days 14`), set a date with `shelf due`, or `shelf keep` a skill the project always needs.

## Projects and the lockfile

### "Lockfile lists "x", which is not in this machine's library"

The project borrows a skill this machine's library doesn't have, usually because it was borrowed on another machine. The entry is kept. To get the skill here, copy it into your library from wherever it lives, or adopt the project's committed copy: `shelf adopt .claude/skills/x`.

### Every command in a project fails with CONFLICT "… is not valid JSON" or "… is invalid"

The lockfile was edited by hand or has merge conflict markers. Restore it from version control, or resolve the conflict to valid JSON. See [Lockfile](lockfile.md#never-edit-it-by-hand).

### A project shows as missing

`shelf projects` marks projects whose directory is gone. If it moved, run any shelf command in its new location: the lockfile's id is recognised and the path updated. If it was deleted, `shelf doctor --fix` forgets it.

## Library

### A skill is missing from catalog

Its SKILL.md isn't valid (no frontmatter, missing description, `name` not matching the directory, description over 1024 characters), so shelf skips it. `shelf doctor` names the file and the problem. Or it was archived; look in `~/.shelf/archive/`.

### Every command fails with "Invalid config"

`~/.shelf/config.json` isn't valid JSON or has a value of the wrong type. The message names the key. See [Configuration](configuration.md#invalid-config).

### An agent says it isn't allowed to import a skill

That is `NOT_ALLOWED`: agents may review skills from git sources but not import them unless you set `allowAgentImports`. Run the command the agent shows you yourself. See [Importing skills](importing-skills.md#what-agents-may-do).

## Installing

### macOS refuses to open the binary

The binaries aren't code-signed yet. Run `xattr -d com.apple.quarantine shelf` once.

### npm installs shelf but it says "no prebuilt binary"

npm skipped optional dependencies. Reinstall without `--no-optional` or `--omit=optional`, or download the binary from the releases page.

### Hooks point at the old binary after upgrading

Run `shelf setup` (or `shelf doctor --fix`). Hooks use the binary's absolute path.

### setup reports a harness as "skipped"

Its settings file (`~/.claude/settings.json` or `~/.codex/hooks.json`) isn't a JSON object, so shelf left it alone. Fix the file and run `shelf setup` again, or add the hook entries by hand ([Hooks](hooks.md#install)).

## Dashboard

### Failed to start server. Is port N in use?

Another process, maybe another `shelf ui`, has that port. Stop it, or pick another `--port`.

### A bookmark stopped working

Without `--port`, the dashboard picks a new port each time; the token is the same. Start it with a fixed port (`shelf ui --port 4300`) and bookmark that.

### The dashboard shows "Connect to shelf"

The browser has no token, or an old one (after `--rotate-token`). Open the link printed by `shelf ui`, or paste the part after `?token=`.

### I can't open the dashboard from my phone

It listens on 127.0.0.1 only and checks the `Host` header, by design. See [Dashboard: phones and tablets](dashboard.md#phones-and-tablets).

## Still stuck

Run the failing command with `--json` and read `error.hint`. If it is an `INTERNAL` error, run it without `--json` to see the stack trace, and open an issue at https://github.com/limyuquan/shelf/issues with the command, the output and `shelf --version`.

## Related

- [Errors](errors.md), [`shelf doctor`](cli/doctor.md), [FAQ](faq.md)
