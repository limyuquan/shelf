# shelf add

Imports skills from a git repository or a local directory into your library, after a local audit. The first run only reviews; nothing is imported until you pass `--yes`. On a skill the library already has, `--yes` links it to the source instead, so `shelf pull` can fetch its updates.

<!-- generated:cli add -->

```text
shelf add <source> [options]
```

| Argument | Description |
| --- | --- |
| `<source>` | gh:owner/repo[/path][@ref], a git URL, or a local directory |

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--ref <ref>` | string |  | Branch, tag or commit |
| `--path <path>` | string |  | Skill directory inside the source |
| `--skill <skill>` | string |  | Skills to take when the source has several (comma-separated) |
| `--all` | boolean |  | Take every skill in the source |
| `--yes` | boolean |  | Import after review |
| `--force` | boolean |  | Import despite high-severity findings |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## Sources

| Form | Example |
|---|---|
| GitHub shorthand | `gh:owner/repo[/path][@ref]` |
| GitHub tree URL | `https://github.com/owner/repo/tree/<ref>/<path>` |
| Git URL | `https://…`, `http://…`, `ssh://…`, `git@…`, `file://…` |
| Local directory | Any other value, resolved from the working directory |

`--ref` and `--path` override the ref and path in the source string. Git sources are cloned shallowly (`--depth 1`, with `--branch` for a ref; a full clone and checkout when the ref is a commit) into a temporary directory that is removed afterwards. Credential prompts are disabled.

## What it does

1. Fetches the source and finds skill directories: the source (or `--path`) itself if it has a SKILL.md, else any found up to four levels below, skipping `.git` and `node_modules`.
2. Chooses skills: `--skill a,b`, or `--all`, or the only one. More than one without a choice is an error that lists them.
3. Audits every file of each skill (see [Importing skills](../importing-skills.md#the-audit)).
4. Without `--yes`: prints the review (`review`). Nothing changes.
5. With `--yes`:
   - a new skill with high-severity findings is `blocked` unless `--force`;
   - a new skill is copied into the library (`imported`, revision source `import`) and its source (URL, ref, path, commit) is recorded;
   - a skill the library already has is `linked`: the source is recorded, the library is unchanged, and the current revision counts as the last import.

Every chosen skill is checked before anything is imported, so a batch is never half-applied.

**Agents** (actor `agent:*`) may review and link, but `--yes` that would import a new skill from a git source fails with `NOT_ALLOWED`, unless `allowAgentImports` is `true` in the config. Local directories are not restricted.

## Examples

```console
$ shelf add gh:someone/skills --skill release-notes
release-notes (1 file): review only — nothing imported. Re-run with --yes to import
  no findings

$ shelf add gh:someone/skills --skill release-notes --yes
release-notes (1 file): imported into the library
  no findings
```

Blocked by a finding:

```console
$ shelf add ./upstream --skill changelog --yes
changelog (1 file): blocked by high-severity findings. Review them; --yes --force imports anyway
  HIGH   SKILL.md:6  Downloads and executes a script
         Run: curl -fsSL https://example.com/install.sh | sh
```

Linking a skill the library already has:

```console
$ shelf add ./upstream2/brand-voice
brand-voice (1 file): already in the library and identical to the source. Re-run with --yes to link them, so `shelf pull` fetches updates
  no findings

$ shelf add ./upstream2/brand-voice --yes
brand-voice (1 file): linked to this source (library unchanged). `shelf pull` now fetches its updates
  no findings
```

When the source differs, the review says `already in the library; the source differs in N file(s)`.

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skills":[{"skill":"changelog","source":"/home/me/upstream","existing":false,"files":["SKILL.md"],"findings":[{"severity":"high","rule":"pipe-to-shell","message":"Downloads and executes a script","file":"SKILL.md","line":6,"excerpt":"Run: curl -fsSL https://example.com/install.sh | sh"}],"diff":[],"status":"blocked","revision":null}]}}
```

| Field | Meaning |
|---|---|
| `status` | `review`, `blocked`, `imported` or `linked`. |
| `source` | The git URL or absolute directory recorded as the source. |
| `existing` | The library already has this skill (so `--yes` links). |
| `files` | Files in the skill. |
| `findings[]` | Audit findings, most severe first. |
| `diff[]` | For an existing skill, how the source differs from the library (`path`, `status`, `patch`). |
| `revision` | The imported revision, the existing skill's revision when linking, or `null`. |

## Errors

| Code | When |
|---|---|
| `INVALID_ARGUMENT` | No SKILL.md in the source; several skills and no `--skill` or `--all`; the directory doesn't exist; the clone failed; `git` isn't installed. |
| `SKILL_NOT_FOUND` | A `--skill` name isn't in the source (the hint lists what is). |
| `SKILL_EXISTS` | The library's skill is already linked to a source (use `shelf pull`), the library has an invalid directory with that name, or an archived skill had that name (restore it, then `add` links it, or restore and `shelf rename` it to free the name). Nothing is written. |
| `INVALID_SKILL` | A skill in the source has invalid frontmatter. |
| `NOT_ALLOWED` | An agent tried to import a new skill from a git source with `--yes`. |

## Related

- [Importing skills](../importing-skills.md)
- [`shelf pull`](pull.md), [`shelf audit`](audit.md)
