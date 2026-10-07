# shelf set

Groups library skills into named sets that you borrow together with `shelf borrow @<set>`. The subcommands list, save (create or replace) and delete sets.

<!-- generated:cli set -->

```text
shelf set <command>
```

| Command | Description |
| --- | --- |
| `shelf set list` | List your skill sets |
| `shelf set save` | Create a set, or replace its skills (accepts @set to extend another set) |
| `shelf set delete` | Delete a set (borrowed skills and loans are unaffected) |

<!-- /generated -->

Sets are stored in your database, per machine. Borrowing a set creates an ordinary loan for each of its skills; nothing about the set reaches a project or its lockfile. See [Sets](../sets.md).

## shelf set list

Lists your sets with their skills and descriptions.

<!-- generated:cli set list -->

```text
shelf set list
```

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

```console
$ shelf set list
NAME      SKILLS                                                        DESCRIPTION
backend   api-design, git-hygiene, sql-migrations                       
frontend  accessibility-audit, playwright-testing, react-best-practic…  UI work in React apps
```

With no sets: ``No sets yet. Create one with `shelf set save <name> <skill…>`.`` Skills are listed alphabetically; archived skills are left out.

```json
{"schemaVersion":1,"ok":true,"data":{"sets":[{"name":"frontend","description":"UI work in React apps","skills":["playwright-testing","react-best-practices"]},{"name":"web","description":"","skills":["api-design","playwright-testing","react-best-practices"]}]}}
```

## shelf set save

Creates a set, or replaces the skills of an existing one.

<!-- generated:cli set save -->

```text
shelf set save <name> <skill>... [options]
```

| Argument | Description |
| --- | --- |
| `<name>` | Set name, e.g. frontend |
| `<skill>...` | One or more skill names |

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--description <description>`, `-d` | string |  | What the set is for |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

- The name follows the skill-name rules (lowercase letters, digits, single hyphens). A leading `@` is ignored.
- Every skill must be in the library.
- A skill argument `@other` includes every skill of the set `other`, expanded at save time.
- `-d` sets the description. Without it, an existing set keeps its description.

```console
$ shelf set save frontend react-best-practices playwright-testing -d "UI work in React apps"
Saved frontend (2 skills): playwright-testing, react-best-practices
Borrow it with `shelf borrow @frontend`

$ shelf set save web @frontend api-design
Saved web (3 skills): api-design, playwright-testing, react-best-practices
Borrow it with `shelf borrow @web`
```

```json
{"schemaVersion":1,"ok":true,"data":{"set":{"name":"demo","description":"","skills":["pdf-tools"]}}}
```

## shelf set delete

Deletes a set. Borrowed skills and loans are not affected.

<!-- generated:cli set delete -->

```text
shelf set delete <name>
```

| Argument | Description |
| --- | --- |
| `<name>` | Set name |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

```console
$ shelf set delete web
Deleted the set web
```

`data.set` is the deleted set, in the same shape as `set save`.

## Errors

| Code | Subcommand | When |
|---|---|---|
| `INVALID_ARGUMENT` | save | The set name is invalid, or no skills were given, or an included `@set` has no skills. |
| `SKILL_NOT_FOUND` | save | A skill isn't in the library, or an included `@set` doesn't exist. |
| `SKILL_NOT_FOUND` | delete | No set by that name. |

```console
$ shelf set delete web --json
{"schemaVersion":1,"ok":false,"error":{"code":"SKILL_NOT_FOUND","message":"No set named \"web\"","hint":"Run `shelf set list` to see your sets"}}
```

Agents create, change or delete sets only when you ask.

## Related

- [Sets](../sets.md), [`shelf borrow`](borrow.md)
