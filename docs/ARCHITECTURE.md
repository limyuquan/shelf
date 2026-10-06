# Architecture

## Layout

```
packages/
  core/      Domain logic. No CLI or HTTP code. The only public surface is src/index.ts.
    src/domain/      Pure types and functions (loan states, due dates, names). No I/O.
    src/library/     Library directories, content hashing, the revision object store.
    src/projection/  Where skills go in a project: harness table, copies, lockfile.
    src/store/       SQLite: connection, migrations, one module per table.
    src/services/    Use cases (borrow, renew, promote, status, …). Take a Context.
  cli/       Thin adapter: parses args, calls one service, renders text or JSON.
  dashboard/ `shelf ui`: Bun.serve JSON API (src/api.ts) over core + Preact app (src/app/).
             The HTML import is bundled and embedded into the compiled binary.
  skill/     The bundled SKILL.md installed by `shelf setup`.
tests/e2e/   Runs the real CLI (or the compiled binary via SHELF_BIN) as a subprocess.
```

Dependencies point one way: `cli → (dashboard →) core/index.ts → services →
(domain, library, projection, store)`. `domain` imports nothing but itself. The
dashboard is another thin adapter over the same services, so its behaviour
cannot drift from the CLI. Its response shapes live in `dashboard/src/contract.ts`,
shared by server and browser code (type-only imports from core).

## Dashboard security

The server binds 127.0.0.1 on a random port. Every API request must carry the
per-process token (from the printed URL, kept in sessionStorage) in a custom
header, and a Host header naming that loopback address — blocking other
browsers' pages, CSRF (custom headers need CORS, which is never granted) and DNS
rebinding. Viewing never mutates: project pages use `projectReport`, not
`status`, so overdue loans are shown rather than returned.

## Who owns which data

| Data | Lives in | Notes |
|---|---|---|
| Skill content (editable) | `~/.shelf/library/<name>/` | The user edits it with any tool. |
| Skill revisions | `~/.shelf/objects/<sha256>/` | Immutable snapshots. Projects are always copied from here. |
| Projects, loans, due dates, events | `~/.shelf/shelf.db` | Per machine. Source of truth for loan state. |
| What a project has borrowed | `<project>/.agents/shelf.lock.json` | Derived from the database on every change. Carries the project id, so a moved directory or a clone on another machine is recognised. |

The library is reconciled lazily: commands that read skills hash the library
directory and record a revision for anything that changed. There is no daemon
and no file watcher.

## Content states

A loan's content state is computed, never stored, from three hashes:

- **base**: the revision the project borrowed (in the lockfile and database)
- **head**: the library's latest revision
- **working**: each copy on disk

`modified`/`diverged` take precedence over `missing`, so a restore can never
overwrite local edits. Any operation that would discard edits (`return`,
`update`, expiry) refuses unless forced.

## Invariants

- shelf never writes into a skill directory it does not manage. Unmanaged
  directories with the same name cause a `CONFLICT`.
- shelf never modifies SKILL.md frontmatter, so hashes match the library and
  strict validators keep accepting the skill.
- Skill copies are written to a staging directory and renamed into place.
- The lockfile has no timestamps, so renewing a loan never changes it.
- Lockfile entries for skills this machine's library does not have are kept.

## Concurrency

Several agents may run shelf at once in the same project.

- SQLite runs in WAL mode with `busy_timeout = 15000`.
- Every write uses `BEGIN IMMEDIATE` (`writeTransaction`). Deferred transactions
  that upgrade from read to write fail instantly with `SQLITE_BUSY` under
  contention instead of waiting.
- File copies happen *outside* transactions, so the write lock is held only
  briefly. The lockfile is the exception: it is regenerated synchronously
  *inside* the transaction, so concurrent writers serialise on the SQLite lock
  and none of them loses another's entry (see the e2e test).
- Operations are safe to retry. Borrow takes over a leftover copy only when it
  is byte-identical to the revision being borrowed.

## Errors and output

Services throw `ShelfError(code, message, hint)`. The CLI maps each code to an
exit code and prints either text or a one-line JSON envelope with
`schemaVersion`. Changing any `data` shape incompatibly requires bumping
`SCHEMA_VERSION` in `packages/cli/src/output.ts`.

## Extending

- **A harness**: add an entry to `packages/core/src/projection/harnesses.ts`
  and a row to [harnesses.md](harnesses.md).
- **A command**: add a service in `core/src/services/`, export it from
  `core/src/index.ts`, and add a `shelfCommand` in `cli/src/commands/`.
- **A schema change**: append a migration to `core/src/store/migrations.ts`.
  Never edit a migration that has been released.
