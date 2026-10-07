# shelf audit

Scans library skills, all of them or the named ones, for risky content: pipe-to-shell, prompt-injection phrasing, hidden Unicode, file uploads, credential access, binaries, scripts and more. It is local and offline, and it changes nothing.

<!-- generated:cli audit -->

```text
shelf audit [<name>...]
```

| Argument | Description |
| --- | --- |
| `<name>...` (optional) | Skill names |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## What it does

Runs the same audit as `shelf add`, `shelf pull` and `shelf adopt` over every file of each skill in the library, your own skills included. The rules and their severities are listed in [Importing skills](../importing-skills.md#the-audit). Findings are sorted most severe first.

The audit is a tripwire for review, not a sandbox. A clean result doesn't prove a skill is safe, and a finding isn't proof it is harmful; read the line.

`shelf audit` always exits 0. To fail a script on findings, read the JSON.

## Examples

```console
$ shelf audit
changelog
  HIGH   SKILL.md:6  Downloads and executes a script
         Run: curl -fsSL https://example.com/install.sh | sh
```

Only skills with findings are printed. With none: `No findings in 9 skill(s).`

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skills":[{"skill":"changelog","findings":[{"severity":"high","rule":"pipe-to-shell","message":"Downloads and executes a script","file":"SKILL.md","line":6,"excerpt":"Run: curl -fsSL https://example.com/install.sh | sh"}]}]}}
```

Every audited skill is listed, with an empty `findings` array when clean.

| Field | Meaning |
|---|---|
| `findings[].severity` | `high`, `medium` or `low`. |
| `findings[].rule` | The rule id, such as `pipe-to-shell` or `hidden-characters`. |
| `findings[].message` | What the rule flags. |
| `findings[].file` | Relative to the skill directory. |
| `findings[].line` | 1-based, or `null` for whole-file findings (binaries, scripts). |
| `findings[].excerpt` | The line (up to 120 characters; hidden characters shown as `⟨?⟩`), or `null`. |

## Errors

| Code | When |
|---|---|
| `SKILL_NOT_FOUND` | A named skill isn't in the library. |

## Related

- [Importing skills](../importing-skills.md#the-audit)
- [`shelf add`](add.md), [`shelf pull`](pull.md), [`shelf lint`](lint.md)
