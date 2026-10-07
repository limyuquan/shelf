# shelf lint

Checks library skills' SKILL.md files against the Agent Skills format and shelf's conventions, and estimates their description and body tokens. Exits with code 1 when any skill has an error.

<!-- generated:cli lint -->

```text
shelf lint [<name>...]
```

| Argument | Description |
| --- | --- |
| `<name>...` (optional) | Skill names. Default: all |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## What it does

Lints the named skills, or every skill in the library. For each it prints the estimated tokens (characters / 4) of the description, which loads in every session, and of the body, which loads on use, then any issues.

| Level | Check |
|---|---|
| error | SKILL.md must start with YAML frontmatter between `---` lines. |
| error | The frontmatter must be valid YAML, and `key: value` pairs. |
| error | `name` is required: a string of at most 64 lowercase letters, digits and single hyphens, matching the directory. |
| error | The directory name is a valid skill name. |
| error | `description` is required: a string of at most 1024 characters. |
| warning | The description is over 300 characters ("every session loads it"). |
| warning | The description doesn't say when to use the skill (no "when", "whenever", "if you", "if the user", "use for", "use to"). |
| warning | The body is empty. |

Errors make a skill invalid for some harnesses; warnings make it costly or hard for an agent to pick. Only errors change the exit code.

`lint` goes by the library's directories, so it also checks skills that don't load. A library directory without frontmatter, without a description, with a description over 1024 characters, or whose `name` doesn't match its directory isn't loaded by other commands (`shelf doctor` reports it under `library`); `lint` reports why, as errors. The dashboard's lint strip runs the same checks on the unsaved draft as you type.

## Examples

```console
$ shelf lint
api-design  ~31 description + ~18 body tokens  ok
git-hygiene  ~17 description + ~18 body tokens
  warning: description doesn't say when to use the skill: add "Use when …"
pdf-tools  ~32 description + ~17 body tokens  ok
```

```console
$ shelf lint
Bad_Name  ~7 description + ~1 body tokens
  error: directory "Bad_Name" is not a valid skill name: rename it (and name:) to lowercase letters, digits and single hyphens
  error: name must be lowercase letters, digits and single hyphens, e.g. pdf-tools
ok-skill  ~7 description + ~0 body tokens
  warning: The body is empty: add the instructions an agent follows
$ echo $?
1
```

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skills":[{"skill":"git-hygiene","issues":[{"level":"warning","message":"description doesn't say when to use the skill: add \"Use when …\""}],"descriptionTokens":17,"bodyTokens":18}],"errors":0}}
```

| Field | Meaning |
|---|---|
| `skills[].issues[]` | `level` (`error` or `warning`) and `message`. |
| `skills[].descriptionTokens` | Description size estimate. |
| `skills[].bodyTokens` | Size estimate of everything after the frontmatter. |
| `errors` | Total errors across all skills. |

When `errors` is above 0, the envelope still says `"ok": true` (the command ran) and the exit code is 1.

## Errors

| Code | When |
|---|---|
| `SKILL_NOT_FOUND` | No library directory with that name has a SKILL.md. |

## Related

- [Writing skills](../writing-skills.md#lint)
- [`shelf doctor`](doctor.md), [`shelf audit`](audit.md)
