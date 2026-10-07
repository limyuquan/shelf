# shelf pull

Updates a skill from the source it was imported from (or linked to) with `shelf add`. It shows the diff and a fresh audit, and changes the library only with `--yes`. Then `shelf propagate` updates borrowing projects.

<!-- generated:cli pull -->

```text
shelf pull <name> [options]
```

| Argument | Description |
| --- | --- |
| `<name>` | Skill name |

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--yes` | boolean |  | Apply after review |
| `--force` | boolean |  | Apply despite high-severity findings or library edits since import |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## What it does

1. Re-fetches the recorded source: the same URL, ref and path (a local directory if the recorded source is a path that exists).
2. If the source matches the library's latest revision: `current`, nothing to do.
3. If the library copy was edited since the last import (its latest revision isn't the one recorded at import), refuses with `CONFLICT` unless `--force`, so your edits aren't clobbered.
4. Diffs the library's latest revision against the source and audits the source.
5. Without `--yes`: prints the review (`review`).
6. With `--yes`: `blocked` on high-severity findings unless `--force`; otherwise replaces the library copy, records a new revision (source `import`) and the new commit (`imported`).

Agents may run the review, but applying a git source with `--yes` fails with `NOT_ALLOWED` unless `allowAgentImports` is set.

## Examples

```console
$ shelf pull release-notes
release-notes: changes available — nothing applied. Re-run with --yes to apply
--- a/SKILL.md
+++ b/SKILL.md
@@ -3,4 +3,5 @@
 description: Draft release notes from merged pull requests, grouped by user impact. Use when preparing a release.
 ---
 
 - Group by user impact
+- Link each item to its pull request
Audit:
  no findings

$ shelf pull release-notes --yes
release-notes updated to 3547e8b373. Run `shelf propagate release-notes` to update borrowers
--- a/SKILL.md
…

$ shelf pull release-notes
release-notes is up to date with /home/me/upstream
```

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skill":"release-notes","source":"/home/me/upstream","commit":null,"diff":[{"path":"SKILL.md","status":"modified","patch":"--- a/SKILL.md\n+++ b/SKILL.md\n@@ -3,4 +3,5 @@\n description: Draft release notes from merged pull requests, grouped by user impact. Use when preparing a release.\n ---\n \n - Group by user impact\n+- Link each item to its pull request\n"}],"findings":[],"revision":"sha256:ddc0bd2a5a8d49842f24450c3c8cd13b8be8d8523127a6543aa7a39ad4dd9eec","status":"review"}}
```

| Field | Meaning |
|---|---|
| `status` | `current`, `review`, `blocked` or `imported`. |
| `source` | The recorded source. |
| `commit` | The fetched commit for git sources, `null` for directories. |
| `diff[]` | Library latest → source. |
| `findings[]` | The fresh audit. |
| `revision` | The library's revision before the pull, or the new one when `imported`. |

## Errors

| Code | When |
|---|---|
| `SKILL_NOT_FOUND` | No skill by that name in the library. |
| `INVALID_ARGUMENT` | The skill has no source (it wasn't added or linked with `shelf add`), or fetching failed. |
| `CONFLICT` | The library copy was edited since the last import, and `--force` wasn't given. |
| `INVALID_SKILL` | The source no longer holds a valid skill at the recorded path. |
| `NOT_ALLOWED` | An agent tried to apply a git source with `--yes`. |

```console
$ shelf pull pdf-tools
error: "pdf-tools" was not imported with `shelf add`; it has no source to pull from
```

## Related

- [Importing skills](../importing-skills.md#pull-upstream-updates)
- [`shelf add`](add.md), [`shelf propagate`](propagate.md)
- The dashboard's skill page has **Check for updates** for linked skills.
