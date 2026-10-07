# shelf init

Registers the current project with shelf by creating `.agents/shelf.lock.json`, so skills can be borrowed into it. Running it again in a project that already uses shelf changes nothing.

<!-- generated:cli init -->
<!-- /generated -->

## What it does

`init` finds the project root (the nearest ancestor with a shelf lockfile, else the nearest git root, else the working directory), writes an empty lockfile with a new project id, and registers the project in your database. The project's name is its directory name.

You don't need `init` in a clone of a project that already has a lockfile: any shelf command there registers it.

Agents should run `init` only when you ask them to start using shelf in a project. `shelf status` deliberately doesn't suggest it.

## Examples

```console
$ cd ~/code/storefront
$ shelf init
Initialized shelf in /home/me/code/storefront

$ shelf init
/home/me/code/storefront already uses shelf

$ cat .agents/shelf.lock.json
{
  "version": 1,
  "project": "da6c4e70-e25d-4d10-a389-b6ed7360fa5a",
  "skills": {}
}
```

Commit the lockfile.

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"project":{"id":"4a0c83eb-468d-4cbb-a855-aa9865ca78fb","path":"/home/me/code/mobile-app","name":"mobile-app","createdAt":"2026-10-07T05:51:36.678Z","lastSeenAt":"2026-10-07T05:51:36.678Z"},"created":true}}
```

`created` is `false` when the project already used shelf.

## Errors

| Code | When |
|---|---|
| `CONFLICT` | An existing lockfile isn't valid JSON or doesn't match the [lockfile schema](../lockfile.md). |

## Related

- [`shelf status`](status.md), [`shelf borrow`](borrow.md)
- [Lockfile](../lockfile.md)
