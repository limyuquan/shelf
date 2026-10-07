# shelf propagate

Pushes the library's latest revision of a skill to every project that borrows it, or only the projects you name. Copies with local edits are never touched. Run it from anywhere.

<!-- generated:cli propagate -->

```text
shelf propagate <name> [options]
```

| Argument | Description |
| --- | --- |
| `<name>` | Skill name |

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--project <project>` | string |  | Limit to these projects (comma-separated names) |
| `--dry-run` | boolean |  | Show what would change without changing it |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## What it does

For every active loan of the skill (in the selected projects):

| Project's copy | Result |
|---|---|
| Already on the latest revision | `already current` |
| Unedited and behind (or missing copies) | Rewritten from the latest revision: `updated` |
| Edited (`modified` or `diverged`) | `skipped (local edits)` |
| Project directory gone | `skipped (directory missing)` |

`--project` takes a comma-separated list of project names, paths or ids. `--dry-run` reports what would happen without writing anything (`would update`).

Use it after editing a skill in the library, `shelf restore`, or `shelf pull --yes`. `shelf promote --propagate` runs it right after promoting.

## Examples

```console
$ shelf propagate pdf-tools --dry-run
pdf-tools → dca5f929e7 (dry run)
  billing-api: would update
  storefront: would update

$ shelf propagate pdf-tools
pdf-tools → dca5f929e7
  billing-api: updated
  storefront: updated
```

With no borrowers: `No projects borrow pdf-tools.`

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skill":"pdf-tools","revision":"sha256:dca5f929e749b602869f964b944ab1c8567353094f413d0f53dabe7dfa015b67","dryRun":true,"projects":[{"project":"billing-api","path":"/home/me/code/billing-api","status":"current"},{"project":"storefront","path":"/home/me/code/storefront","status":"current"}]}}
```

| Field | Meaning |
|---|---|
| `revision` | The library's latest revision, which borrowers were moved to. |
| `dryRun` | Whether this was a dry run. |
| `projects[].status` | `updated` (or would be, in a dry run), `current`, `skipped-local-changes`, `skipped-missing-project`. |

## Errors

| Code | When |
|---|---|
| `SKILL_NOT_FOUND` | No skill by that name in the library. |

## Related

- [Keeping skills current](../keeping-skills-current.md)
- [`shelf update`](update.md) updates one project from inside it; [`shelf promote`](promote.md), [`shelf log`](log.md)
