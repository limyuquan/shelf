# Contributing

## Setup

```sh
bun install          # Bun 1.4.2 (pinned in package.json)
bun run shelf -- status   # run the CLI from source
bun run dev          # the dashboard on demo data; reload to see changes
bun run dev -- --real     # …on your real ~/.shelf instead
```

Use a scratch state directory so you don't touch your real library:

```sh
export SHELF_HOME=$(mktemp -d)
```

## Checks

```sh
bun run check        # lint + typecheck + tests (what CI runs)
bun run format       # apply Biome formatting and import ordering
bun run build        # compile dist/shelf
SHELF_BIN=dist/shelf bun test tests/e2e   # e2e against the binary
```

## Conventions

- Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first. Keep logic in
  `packages/core`; CLI commands only map arguments to a service and render it.
- Services take a `Context` and never read globals (env, cwd, clock). Tests
  build contexts with `createTestEnv()` and a `FakeClock`.
- Tests use real temporary directories, not a mocked filesystem.
- Every failure a user or agent can act on is a `ShelfError` with a `hint`.
- Plain SQL, no ORM. Schema changes are new entries in `migrations.ts`.
- Comments explain *why*. Don't restate the code.

### Dashboard

- A new endpoint is a route in `packages/server/src/routes/` calling a core
  service, with zod schemas for its inputs. Its response type flows to the web
  app through `type Api`; don't declare response types by hand.
- Pages live in `packages/web/src/routes/`; domain logic shared by pages lives
  in `features/<domain>/`; generic UI in `components/ui/`.
- Use the semantic colour tokens (`bg-surface`, `text-fg-muted`, …), never raw
  colours, so both themes keep working. Check both themes, and a phone-width
  window with touch emulation, before submitting. Nothing may depend on hover
  alone: touch screens can't hover.
- Pure helpers go in `lib/` or a feature's `describe.ts` and get unit tests.

## Releasing

1. Bump `version` in every `packages/*/package.json` (the CLI reports
   `packages/cli/package.json`).
2. Commit, then tag and push: `git tag v0.5.0 && git push --tags`.
3. The release workflow checks the tag matches, builds every platform, attaches
   archives and `SHA256SUMS` to a GitHub release, and publishes to npm when the
   `NPM_TOKEN` secret is set (`NPM_SCOPE` changes the package scope).

Locally: `bun run build:all && bun run pack:npm` produces the same artifacts
in `dist/`.
