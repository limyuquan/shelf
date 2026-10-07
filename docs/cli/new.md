# shelf new

Creates a skill in your library: a directory `~/.shelf/library/<name>/` with a SKILL.md holding the name, your description and a placeholder body, recorded as the skill's first revision.

<!-- generated:cli new -->

```text
shelf new <name> [options]
```

| Argument | Description |
| --- | --- |
| `<name>` | Skill name, e.g. pdf-tools |

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--description <description>`, `-d` | string |  | When an agent should use this skill (shown in skill listings) |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## What it does

Writes this SKILL.md and records it:

```markdown
---
name: pdf-tools
description: "Extract text, tables and form fields from PDFs, and fill or merge PDF files. Use when a task involves reading or producing PDFs."
---

# pdf-tools

Describe when and how an agent should apply this skill.
```

Then edit the files with any editor. shelf records each change as a new revision the next time a command reads the library. The description should say what the skill does and when to use it ("Use when …"), in under 300 characters; see [Writing skills](../writing-skills.md).

The name can't be an archived skill's: like `rename` and `duplicate`, `new` refuses it, so the archived skill's history isn't continued by unrelated content. The name and description are checked before anything is written.

## Examples

```console
$ shelf new pdf-tools -d "Extract text, tables and form fields from PDFs, and fill or merge PDF files. Use when a task involves reading or producing PDFs."
Created pdf-tools at /home/me/.shelf/library/pdf-tools
Edit its files with any editor; shelf records each change as a new revision.
```

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skill":"demo-skill","path":"/home/me/.shelf/library/demo-skill","revision":"sha256:de2cb8ae2e7a11b442a9fe7f0d4c88f04fd4efa9e57c733ac34c23e882896cd3"}}
```

## Errors

| Code | When |
|---|---|
| `INVALID_ARGUMENT` | The name isn't 1 to 64 lowercase letters, digits and single hyphens; `-d` is missing; or the description is longer than 1024 characters. Nothing is created. |
| `SKILL_EXISTS` | The library already has a directory with that name, or an archived skill had it. |

```console
$ shelf new PDF -d x
error: Invalid skill name "PDF"
hint: Names are 1-64 lowercase letters, digits and single hyphens, e.g. pdf-tools
```

## Related

- [Writing skills](../writing-skills.md)
- [`shelf lint`](lint.md), [`shelf show`](show.md), [`shelf duplicate`](duplicate.md)
