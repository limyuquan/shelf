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
  server/    `shelf ui`'s HTTP layer: a Hono JSON API over core, plus Bun.serve.
    src/routes/      One module per resource; each route is a thin call into core.
    src/schemas.ts   zod request schemas (the inputs half of the contract).
    src/contract.ts  Browser-safe exports: the `Api` type and the token header.
  web/       The dashboard: a React single-page app (see Web app).
  skill/     The bundled SKILL.md installed by `shelf setup`.
scripts/     Build, cross-compilation, npm packaging, the dev server and demo data.
npm/         The npm launcher script.
tests/e2e/   Runs the real CLI (or the compiled binary via SHELF_BIN) as a subprocess.
```

Dependencies point one way: `cli → server → core/index.ts → services →
(domain, library, projection, store)`, and `web → server/contract` (types only).
`domain` imports nothing but itself. The server is another thin adapter over
the same services, so the dashboard's behaviour cannot drift from the CLI. The
CLI composes the two: it imports the web app's `index.html` and hands it to the
server, so the server package never depends on the web package.

## Web app

```
packages/web/src/
  app/                 Router (code-based route tree), query client, providers.
  api/                 Typed Hono client, `unwrap`, response types derived from `Api`.
  routes/              One file per page; each exports its route (loader + component).
  features/<domain>/   attention, projects, skills, loans, activity: queries,
                       mutations, and the components only that domain uses.
  components/ui/       Design-system primitives (Button, Menu, Dialog, Tooltip, …)
                       on Base UI, styled with Tailwind.
  components/layout/   App shell, sidebar, page header, properties panel, ⌘K menu.
  lib/                 Pure helpers (formatting, theme), unit-tested in test/.
  styles/              tokens.css (semantic colours for both themes) and global.css.
```

- **Contract.** `server/src/app.ts` builds the API by chaining Hono routes, so
  `type Api` carries every path, input and response. The web app's client is
  `hc<Api>()`; response types are derived with `InferResponseType`. Responses
  are typed by the core services' return types, so a change in core, server or
  web that breaks the contract fails `tsc`. Server tests use the same client.
- **Data.** TanStack Router loaders warm TanStack Query's cache
  (`ensureQueryData`); components read it with `useSuspenseQuery`. Mutations
  invalidate everything: the data is local and cheap, and it keeps every view
  consistent without per-mutation cache surgery.
- **Binary-provided values.** Core cannot know the running binary's version,
  bundled skill or hook command, so the CLI passes them to the server
  (`SystemOptions`) for the settings page and repairs.
- **Responsive.** One layout system, no separate mobile app: below `lg` the
  sidebar becomes a drawer opened from the page header; below `xl` detail pages
  stack their properties panel under the content (`SplitView`); rows reflow to
  two lines below `md`; dialogs become bottom sheets below `sm`. Touch screens
  (`pointer-coarse`) get 40px+ targets, always-visible row actions and no
  keyboard hints; fields use 16px text so iOS doesn't zoom.
- **Keyboard.** `lib/hotkeys.ts` provides single-key shortcuts and list
  navigation; both stand down while typing or while a dialog or menu is open.
- **Styling.** Components use semantic tokens (`bg-surface`, `text-fg-muted`,
  `border-border`), never raw colours. `tokens.css` defines them per theme;
  `data-theme` on `<html>` switches dark and light (default: follow the OS).
- **Build.** Bun bundles `index.html` (React, Tailwind via `bun-plugin-tailwind`,
  Inter, CodeMirror) into the compiled binary. `scripts/build.ts` passes the
  Tailwind plugin to `Bun.build`; the dev server gets it from `bunfig.toml`.
  `bun run dev` serves the app on demo data (`scripts/demo/seed.ts`) and rebuilds
  on reload; hot module replacement is off because Bun's HMR runtime breaks on
  TanStack Router's circular imports.

## Dashboard security

The server binds 127.0.0.1 (on a random port unless `--port`). Every API request
must carry the token in a custom header, and a Host naming that loopback address
— blocking other browsers' pages, CSRF
(custom headers need CORS, which is never granted) and DNS rebinding. The token
lives in `~/.shelf/ui-token` (mode 0600) so bookmarks and home-screen shortcuts
survive restarts; the app moves it from the URL into localStorage and strips it
from the address bar, and shows a Connect screen when it is missing or wrong.

shelf never listens beyond loopback and has no remote-access mode. Viewing never mutates: project
pages use `projectReport` and Attention uses `listAttention`, not `status`, so
overdue loans are shown rather than returned.

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

`adopt` sets a loan's base to the copy's own revision when the copy matches an
earlier revision of the library skill, or when `--unedited` declares it one
(the copy is then stored as a revision with source `adopt`). Such loans are
`behind`, not `modified`, so an agent is never invited to promote stale content.

## Renew on use

A loan's due date slides to `loanDays` from now whenever the skill is used
(`recordUse` in `services/usage.ts`), so expiry means "unused for a loan
period". Uses are written at most once an hour per loan (`last_used_at`) and
logged as `loan.used` at most once a day.

Uses come from harness hooks that `shelf setup` installs (`services/hooks.ts`)
in Claude Code's `settings.json` and Codex's `hooks.json`:

- `shelf hook skill-use` (PostToolUse, UserPromptSubmit) matches the payload
  against the project's lockfile: the Skill tool naming a borrowed skill, a
  path inside a borrowed copy, or a prompt invoking one. A string pre-check
  rejects ordinary tool calls before any file or database is opened.
- `shelf hook session-start` syncs the project and prints one line only when
  something needs attention (`services/session.ts`). Output is the only thing
  hooks add to an agent's context, so a healthy project costs nothing.

Hooks never fail the agent's turn: errors go to stderr and the exit code is 0.
Hook entries are recognised by their command (`shelf hook …`), so re-running
setup replaces them (e.g. after the binary moved) and `--no-hooks` removes only
them. The hook command is the binary's absolute path, because hooks may run
without the user's shell PATH.

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

## Link mode

A loan's `mode` is `copy` (every target holds a copy) or `link` (the first
target holds the copy; the others are relative symlinks, junctions on Windows).
Hashing and copying follow symlinks, so content states work the same either way.

Projects sometimes symlink one harness directory to another (e.g.
`.claude/skills` → `.agents/skills`). Targets are compared by real path
(`distinctTargets`): aliases are dropped from new loans, never written twice,
never turned into a link to themselves, and removing one name never deletes
the copy behind another.

## Importing and auditing

`shelf add` fetches a source (shallow `git clone` with prompts disabled, or a
local directory), audits it with `core/src/security/audit.ts`, and returns a
review. Nothing enters the library without `yes`; high-severity findings also
need `force`. The source (URL, ref, path, commit, resulting revision) is kept in
`skill_sources`, so `shelf pull` can re-fetch, diff, re-audit, and refuse to
clobber library edits made since the import. When the library already has the
skill (e.g. adopted from projects), `add --yes` only records the source, taking
the current revision as the last import, so the next `pull` offers the
upstream version as a reviewed update. Agents (actor `agent:*`) may review and
link, but changing library content from a remote source (`add --yes` of a new
skill, `pull --yes`) is refused unless `allowAgentImports` is set.

The audit is a tripwire for human review, not a sandbox: pattern rules
(pipe-to-shell, decode-and-run, prompt-injection phrasing, file uploads,
credential paths, raw-IP URLs, encoded blobs, destructive commands), invisible
and bidi Unicode, binaries and scripts.

## Distribution

`scripts/build-all.ts` cross-compiles every platform in `scripts/targets.ts`.
`scripts/pack-npm.ts` lays out one npm package per platform (`os`/`cpu`-gated,
holding the binary) and a launcher package (`npm/shelf.js`) whose
`optionalDependencies` list them — the esbuild/biome pattern, with no install
scripts. `.github/workflows/release.yml` runs both on a version tag.

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
