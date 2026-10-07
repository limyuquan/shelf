# shelf projects

Lists every project registered with shelf on this machine, with its number of loans, how many are due soon or overdue, and its path. It reads the database only and changes nothing.

<!-- generated:cli projects -->

```text
shelf projects
```

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## What it does

Lists registered projects in alphabetical order. Counts come from the database (no files are hashed), so it is fast and never returns anything. A project whose directory no longer exists is marked `(missing)`; `shelf doctor --fix` forgets projects that no longer have a lockfile.

Projects are registered by `shelf init`, by `shelf adopt`, and by running any project command in a clone or moved directory that has a lockfile.

## Examples

```console
$ shelf projects
PROJECT      LOANS  DUE SOON  OVERDUE  PATH
billing-api  4      0         0        /home/me/code/billing-api
docs-site    2      0         1        /home/me/code/docs-site
mobile-app   2      0         0        /home/me/code/mobile-app
storefront   4      1         0        /home/me/code/storefront
```

With none: ``No projects yet. Run `shelf init` inside one.``

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"projects":[{"id":"271949f0-7dc1-437e-93b2-ccb03cfec021","name":"billing-api","path":"/home/me/code/billing-api","exists":true,"lastSeenAt":"2026-10-07T05:34:38.006Z","loans":2,"dueSoon":0,"overdue":0}]}}
```

| Field | Meaning |
|---|---|
| `id` | The project id from its lockfile. |
| `exists` | Whether the directory exists. |
| `lastSeenAt` | When shelf last opened the project (updated at most every 10 minutes). |
| `loans`, `dueSoon`, `overdue` | Active loans, and how many are due soon or overdue (kept loans count as neither). |

## Errors

None specific to this command.

## Related

- [`shelf sweep`](sweep.md), [`shelf status`](status.md), [`shelf doctor`](doctor.md)
