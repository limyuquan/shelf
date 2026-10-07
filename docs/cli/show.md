# shelf show

Prints a library skill's SKILL.md with its revision, size and file list, or, with `--revision`, any recorded revision of it. Use it to read a skill before borrowing it.

<!-- generated:cli show -->
<!-- /generated -->

## What it does

Without `--revision`, it prints the library copy: the latest revision, the number of revisions, the size of SKILL.md in tokens (characters / 4), the path, every file, then SKILL.md.

With `--revision`, it reads the snapshot from the object store instead: the revision's date, source and file list, then its SKILL.md. The revision is `latest`, a full hash (`sha256:…` or bare hex), or a unique prefix of at least 6 hex characters. Only this skill's revisions are candidates. See [`shelf log`](log.md) for the list.

## Examples

```console
$ shelf show pdf-tools
pdf-tools  rev ddad27dd34  (1 revisions, ~60 tokens)
path:  /home/me/.shelf/library/pdf-tools
files: SKILL.md

---
name: pdf-tools
description: "Extract text, tables and form fields from PDFs, and fill or merge PDF files. Use when a task involves reading or producing PDFs."
---

# pdf-tools

Describe when and how an agent should apply this skill.
```

```console
$ shelf show pdf-tools --revision ddad27
pdf-tools  rev ddad27dd34  2026-10-07  library  (~60 tokens)
files: SKILL.md

---
name: pdf-tools
…
```

The header of an old revision says `(latest)` after the hash when it is the latest.

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"name":"api-design","description":"Design HTTP APIs: resource naming, error envelopes, pagination and versioning. Use when adding or changing API endpoints.","revision":"sha256:d74c95b92cffd891a2c5de8a17c11ae8ed067d403dd8993f5c24e94625d29904","revisions":3,"tokens":83,"borrowers":2,"source":null,"loanDays":30,"customLoanDays":null,"path":"/home/me/.shelf/library/api-design","files":["SKILL.md"],"content":"---\nname: api-design\n…"}}
```

The fields of [`shelf catalog`](catalog.md#json-output), plus `path` (the library directory), `files` (relative paths, sorted) and `content` (SKILL.md).

With `--revision`:

| Field | Meaning |
|---|---|
| `skill` | The skill name. |
| `revision` | The full hash. |
| `source` | `library`, `promote`, `import` or `adopt`. |
| `createdAt` | When it was recorded. |
| `latest` | Whether it is the library's latest revision. |
| `parent` | The previous revision's hash, or `null`. |
| `files` | Relative paths in the snapshot, sorted. |
| `content` | The snapshot's SKILL.md. |
| `tokens` | SKILL.md size estimate. |

## Errors

| Code | When |
|---|---|
| `SKILL_NOT_FOUND` | No skill by that name in the library (or it is archived, or invalid). |
| `INVALID_ARGUMENT` | The revision is shorter than 6 characters, ambiguous, or unknown. The hint lists candidates. |
| `CONFLICT` | The revision's snapshot is missing from the object store (run `shelf doctor`). |

```console
$ shelf show pdf-tools --revision dd
error: Revision "dd" is too short: use at least 6 characters of the hash
hint: Candidates: ddad27dd34. Run `shelf log pdf-tools` to list its revisions
```

## Related

- [`shelf log`](log.md), [`shelf diff`](diff.md), [`shelf catalog`](catalog.md)
