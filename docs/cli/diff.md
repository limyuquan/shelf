# shelf diff

Shows a unified diff between two versions of a skill: the revision a project borrowed, the library's latest, the project's copy on disk, or any recorded revision. Use it to review local edits before promoting them, or library changes before updating.

<!-- generated:cli diff -->

```text
shelf diff <name> [options]
```

| Argument | Description |
| --- | --- |
| `<name>` | Skill name |

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--from <from>` | string |  | borrowed \| library \| project \| &lt;revision&gt; |
| `--to <to>` | string |  | borrowed \| library \| project \| &lt;revision&gt; |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## Sides

`--from` and `--to` each take one of:

| Side | Meaning |
|---|---|
| `borrowed` | The revision this project borrowed. Needs a project that borrows the skill. |
| `library` | The library's latest revision. |
| `latest` | Same as `library`. |
| `project` | This project's copy on disk: the edited copy if there is one, else the first copy present. Needs a project that borrows the skill. |
| a revision | A full hash or a unique prefix of at least 6 hex characters (see `shelf log`). |

Defaults:

| Where | `--from` | `--to` |
|---|---|---|
| In a project that borrows the skill, copy edited | `borrowed` | `project` (the local edits) |
| In a project that borrows the skill, copy unedited | `borrowed` | `library` (what updating would change) |
| Anywhere else | the latest revision's parent | `library` (the last library change) |

Files are compared byte for byte. Binary files show `Binary file <path> differs`.

## Examples

Local edits in a project:

```console
$ shelf diff pdf-tools
--- a/SKILL.md
+++ b/SKILL.md
@@ -5,4 +5,6 @@
 
 # pdf-tools
 
 Describe when and how an agent should apply this skill.
+
+- Prefer pdftotext for scanned files
```

What the library changed since this project borrowed:

```console
$ shelf diff pdf-tools --from borrowed --to library
--- a/SKILL.md
+++ b/SKILL.md
@@ -5,6 +5,4 @@
 
 # pdf-tools
 
 Describe when and how an agent should apply this skill.
-
-- Prefer pdftotext for scanned files
```

Between two revisions, from anywhere: `shelf diff pdf-tools --from d4deea --to latest`. When there is nothing to show: `No differences between borrowed and library.`

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skill":"pdf-tools","from":{"side":"borrowed","revision":"sha256:ddad27dd34082032a0f9564e301c57903aeb482c1f97b56b07844301a222bc36"},"to":{"side":"project","revision":"sha256:d4deea4b55d45984ad84b4ea9db4211166df58840a9a66b02530604b34a4f20c"},"files":[{"path":"SKILL.md","status":"modified","patch":"--- a/SKILL.md\n+++ b/SKILL.md\n@@ -5,4 +5,6 @@\n \n # pdf-tools\n \n Describe when and how an agent should apply this skill.\n+\n+- Prefer pdftotext for scanned files\n"}]}}
```

| Field | Meaning |
|---|---|
| `from`, `to` | `side` as given or defaulted, and the `revision` hash it resolved to (for `project`, the hash of the copy on disk). |
| `files[]` | Changed files only: `path`, `status` (`added`, `removed`, `modified`) and `patch` (a unified diff). Empty when identical. |

## Errors

| Code | When |
|---|---|
| `SKILL_NOT_FOUND` | No skill by that name in the library. |
| `NOT_BORROWED` | `borrowed` or `project` outside a project that borrows the skill. |
| `INVALID_ARGUMENT` | A revision is too short, ambiguous or unknown. |
| `CONFLICT` | `project`, but every copy is missing (run `shelf sync`). |

## Related

- [Keeping skills current](../keeping-skills-current.md)
- [`shelf promote`](promote.md), [`shelf update`](update.md), [`shelf log`](log.md)
