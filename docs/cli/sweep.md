# shelf sweep

Runs `shelf sync` in every registered project: returns overdue loans without local edits, restores missing copies and updates `--follow` loans everywhere, without visiting each project. Run it daily from cron, a systemd timer or launchd.

<!-- generated:cli sweep -->
<!-- /generated -->

## What it does

Reconciles the library once, then for each registered project whose directory exists, does what [`shelf sync`](sync.md) does there. Projects whose directory is gone are listed as missing, not changed.

See [Automation](../automation.md#sweep-every-project-daily) for cron, systemd and launchd examples.

## Examples

```console
$ shelf sweep
Synced 3 project(s).
  billing-api: updated pdf-tools
```

Only projects where something changed get a line (`returned …`, `restored …`, `updated …`). A missing project:

```console
$ shelf sweep
Synced 4 project(s).
  docs-site: /home/me/code/docs-site is missing (`shelf doctor --fix`)
```

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"synced":[{"project":{"id":"271949f0-7dc1-437e-93b2-ccb03cfec021","name":"billing-api","path":"/home/me/code/billing-api"},"expired":[],"restored":[],"updated":[],"warnings":[]}],"missing":[]}}
```

`synced[]` has one [`shelf sync` result](sync.md#json-output) per project. `missing[]` lists `{ id, name, path }` of projects whose directory doesn't exist.

## Errors

| Code | When |
|---|---|
| `CONFLICT` | A project's lockfile is invalid. |

## Related

- [Automation](../automation.md)
- [`shelf sync`](sync.md), [`shelf doctor`](doctor.md)
