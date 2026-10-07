# shelf targets

Shows or changes which harness skill directories this project writes borrowed skills to. Without options it lists every known harness, marks the ones it detects in the project, and suggests adding those that don't read `.agents/skills`.

<!-- generated:cli targets -->

```text
shelf targets [options]
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--add <add>` | string |  | Harness ids or directories to add (comma-separated) |
| `--remove <remove>` | string |  | Harness ids or directories to remove |
| `--reset` | boolean |  | Use your default targets (config) again |
| `--force` | boolean |  | Remove copies even if they have local edits |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## What it does

Without options, reports the project's targets and every harness shelf knows (see [Harnesses](../harnesses.md#harness-ids)):

| Note | Meaning |
|---|---|
| `on` | A target of this project. |
| `detected` | The harness's config directory (such as `.kiro/`) exists in the project. |
| `reads .agents/skills` | The harness already finds skills in `.agents/skills`, so it needs no target. |
| `same directory as … (symlink)` | The directory is a symlink to an existing target, so it is covered. |

With `--add`, `--remove` or `--reset`, it changes the targets and moves every loan to match: copies appear in added directories (from the loan's revision, never from edited copies) and are removed from removed ones. Then it reports the new state.

| Option | Effect |
|---|---|
| `--add a,b` | Add harness ids or project-relative directories. |
| `--remove a,b` | Remove them. |
| `--reset` | Use your default targets (config `targets`) again; the lockfile's `targets` is dropped. |
| `--force` | Remove copies even if they have local edits. |

The project's targets are stored in its lockfile, so clones use them. A target can be any directory inside the project, not only a known harness's. A project needs at least one. Loans that have extra targets of their own (for example an adopted `.cursor/skills` copy) keep them.

Agents change targets only when you ask.

## Examples

```console
$ shelf targets
Skills are written to: .agents/skills, .claude/skills (your default)

HARNESS    DIRECTORY              NOTE
agents     .agents/skills     on  detected
claude     .claude/skills     on  detected
kiro       .kiro/skills           detected
github     .github/skills         reads .agents/skills
cursor     .cursor/skills         reads .agents/skills
gemini     .gemini/skills         reads .agents/skills
opencode   .opencode/skills       reads .agents/skills
devin      .devin/skills          reads .agents/skills
windsurf   .windsurf/skills       reads .agents/skills
roo        .roo/skills            reads .agents/skills
cline      .cline/skills          reads .agents/skills
factory    .factory/skills        reads .agents/skills
goose      .goose/skills          reads .agents/skills
junie      .junie/skills          
qwen       .qwen/skills           
trae       .trae/skills           
openhands  .openhands/skills      

Kiro is used here but does not read .agents/skills: shelf targets --add kiro
```

```console
$ shelf targets --add kiro
Skills are written to: .agents/skills, .claude/skills, .kiro/skills
…
```

The lockfile then has `"targets": [".agents/skills", ".claude/skills", ".kiro/skills"]`.

## JSON output

Trimmed to three harnesses:

```json
{"schemaVersion":1,"ok":true,"data":{"targets":[".agents/skills",".claude/skills"],"custom":true,"harnesses":[{"id":"agents","label":"Agent Skills convention (Codex, Cursor, Gemini CLI, Copilot, …)","dir":".agents/skills","enabled":true,"readsAgentsDir":true,"detected":true,"sharedWith":null},{"id":"claude","label":"Claude Code","dir":".claude/skills","enabled":true,"readsAgentsDir":false,"detected":true,"sharedWith":null},{"id":"kiro","label":"Kiro","dir":".kiro/skills","enabled":false,"readsAgentsDir":false,"detected":true,"sharedWith":null}]}}
```

| Field | Meaning |
|---|---|
| `targets` | The project's target directories. |
| `custom` | `true` when the lockfile overrides your default targets. |
| `harnesses[]` | `id`, `label`, `dir`, `enabled`, `readsAgentsDir`, `detected`, and `sharedWith` (the target it is a symlink to, or `null`). |

## Errors

| Code | When |
|---|---|
| `NOT_INITIALIZED` | Not inside a shelf project. |
| `INVALID_ARGUMENT` | A value is neither a harness id nor a directory inside the project (absolute or `..` paths), or no target would be left. |
| `LOCAL_CHANGES` | A copy to be removed has local edits; promote first or use `--force`. |

```console
$ shelf targets --add /etc
error: "/etc" is not a harness id or a directory inside the project
hint: Known harnesses: agents, claude, kiro, github, cursor, gemini, opencode, devin, windsurf, roo, cline, factory, goose, junie, qwen, trae, openhands
```

## Related

- [Harnesses](../harnesses.md)
- [Configuration](../configuration.md) (`targets`, `mode`)
