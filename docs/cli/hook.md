# shelf hook

Runs a harness hook. `shelf setup` installs it in Claude Code and Codex, and the harness calls it with a JSON payload on stdin. It is hidden from `shelf --help` because people and agents never need to run it.

<!-- generated:cli hook -->

```text
shelf hook <event> [options]
```

| Argument | Description |
| --- | --- |
| `<event>` | session-start \| skill-use |

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--harness <harness>` | string |  | Which harness runs the hook, e.g. claude-code |

<!-- /generated -->

## Events

| Event | Installed for | Does | Prints |
|---|---|---|---|
| `session-start` | `SessionStart` | Syncs the project (returns overdue loans without edits, restores missing copies, updates `follow` loans) and reports what needs attention. | One `shelf: …` line, or nothing. |
| `skill-use` | `PostToolUse`, `UserPromptSubmit` | Records a use of each borrowed skill the payload shows being used, which renews it. | Nothing. |

`--harness` names the harness (`claude-code` or `codex`); the actor recorded in the activity log is `agent:<harness>` (`agent:unknown` without it).

## Payload

The harness's JSON on stdin. shelf reads these fields and ignores the rest:

| Field | Used for |
|---|---|
| `cwd` | Which project the hook runs in (default: the working directory). |
| `tool_name` | `Skill` means the Skill tool. |
| `tool_input` | For the Skill tool, `skill` names the skill. Every string in it (to a depth of 4) is checked for a path inside a borrowed copy, such as `.agents/skills/pdf-tools/SKILL.md`. |
| `prompt` | `UserPromptSubmit`: `/name` or `$name` at the start or after whitespace invokes a skill. |

Before opening any file or database, `skill-use` rejects payloads that can't be a skill use: not the Skill tool, no `/x` or `$x` in a prompt, and no string in the tool input containing `skills`. Uses are matched only against skills in the project's lockfile, and only in a registered project.

## Behaviour

- **Never fails the turn.** Errors are written to stderr as `shelf hook <event>: <message>` and the exit code is always 0.
- **Silent outside shelf projects.**
- **Cheap.** `skill-use` writes a use at most once an hour per loan.

## Examples

```console
$ echo '{"cwd":"/home/me/code/storefront"}' | shelf hook session-start --harness claude-code
shelf: due soon unless used: git-hygiene (4d) — `shelf renew <name>` to keep, `shelf return <name>` if unneeded; edited here: react-best-practices — `shelf promote <name>` publishes to the library. Details: `shelf status`.

$ echo '{"cwd":"/home/me/code/storefront","tool_name":"Skill","tool_input":{"skill":"git-hygiene"}}' | shelf hook skill-use --harness claude-code
```

The second prints nothing, and `git-hygiene` is then used today and due in 30 days.

## JSON output

None: `hook` has no `--json`. The session-start line is plain text for the harness to add to the agent's context.

## Errors

None: it always exits 0. An unknown event prints `shelf hook <event>: unknown hook event "<event>"` to stderr.

## Related

- [Hooks](../hooks.md), [`shelf setup`](setup.md), [`shelf used`](used.md)
