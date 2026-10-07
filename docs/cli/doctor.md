# shelf doctor

Checks shelf's state for problems: invalid library skills, a missing or outdated bundled skill, missing or outdated hooks, projects that no longer exist, leftovers from interrupted writes, and the object store. `--fix` repairs what it safely can.

<!-- generated:cli doctor -->

```text
shelf doctor [options]
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--fix` | boolean |  | Repair fixable problems |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## Checks

| Id | Checks | `--fix` |
|---|---|---|
| `library` | Every library directory with a SKILL.md is a valid skill (frontmatter, a `name` matching the directory, a description of at most 1024 characters). | No: fix the SKILL.md by hand. |
| `bundled-skill` | The bundled `shelf` skill is installed and current in every user skill directory `shelf setup` writes to. | Rewrites it. |
| `hooks` | Claude Code's and Codex's hooks are present and point at this binary. Skipped when `hooks` is `false` in the config. | Reinstalls them (not when the settings file isn't valid JSON). |
| `projects` | Every registered project still has a lockfile. | Forgets projects that don't (their loans go with them). |
| `staging` | No leftover `*.shelf-<uuid>` directories from interrupted writes in the library, the object store, lockfile directories or skill directories. | Deletes them. |
| `revisions` | Every borrowed revision is stored in the object store. | No: `shelf update` the affected loans. |
| `objects` | Every snapshot in the object store belongs to a recorded revision. | Deletes orphaned snapshots. |

A check is `ok` when it found no problems, or `--fix` fixed all of them. `shelf doctor` always exits 0; read the JSON to act on warnings in scripts.

The dashboard's **Settings → Health** shows the same checks, and **Repair** runs `--fix`.

## Examples

```console
$ shelf doctor
ok    library: All library skills are valid
ok    bundled-skill: The shelf skill is installed for every harness
ok    hooks: Hooks renew loans on use in every installed harness
ok    projects: Every registered project exists
ok    staging: No leftovers from interrupted writes
ok    revisions: Every borrowed revision is stored
ok    objects: Every stored snapshot belongs to a revision
```

With problems:

```console
$ shelf doctor
warn  library: 1 problem(s), 0 fixed
        /home/me/.shelf/library/broken/SKILL.md has no YAML frontmatter
warn  bundled-skill: 1 problem(s), 0 fixed
        /home/me/.claude/skills/shelf/SKILL.md is missing
ok    hooks: Hooks renew loans on use in every installed harness
warn  projects: 1 problem(s), 0 fixed
        docs-site: /home/me/code/docs-site no longer has a shelf lockfile
warn  staging: 1 problem(s), 0 fixed
        /home/me/.shelf/objects/x.shelf-12345678-1234-1234-1234-123456789abc
ok    revisions: Every borrowed revision is stored
ok    objects: Every stored snapshot belongs to a revision

$ shelf doctor --fix
warn  library: 1 problem(s), 0 fixed
        /home/me/.shelf/library/broken/SKILL.md has no YAML frontmatter
ok    bundled-skill: 1 problem(s), 1 fixed
        fixed: /home/me/.claude/skills/shelf/SKILL.md is missing
ok    hooks: Hooks renew loans on use in every installed harness
ok    projects: 1 problem(s), 1 fixed
        fixed: docs-site: /home/me/code/docs-site no longer has a shelf lockfile
ok    staging: 1 problem(s), 1 fixed
        fixed: /home/me/.shelf/objects/x.shelf-12345678-1234-1234-1234-123456789abc
ok    revisions: Every borrowed revision is stored
ok    objects: Every stored snapshot belongs to a revision
```

With hooks turned off (`shelf setup --no-hooks`), the hooks line reads ``ok    hooks: Hooks are turned off; loans renew only with `shelf renew` ``.

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"checks":[{"id":"library","status":"ok","message":"All library skills are valid","problems":[],"fixed":[]},{"id":"bundled-skill","status":"ok","message":"The shelf skill is installed for every harness","problems":[],"fixed":[]}]}}
```

| Field | Meaning |
|---|---|
| `checks[].id` | One of the ids above. |
| `checks[].status` | `ok` or `warn`. |
| `checks[].message` | A summary. |
| `checks[].problems` | Every problem found. |
| `checks[].fixed` | The problems `--fix` repaired (repeated from `problems`). |

## Errors

None specific to this command.

## Related

- [Troubleshooting](../troubleshooting.md)
- [`shelf setup`](setup.md), [Hooks](../hooks.md)
