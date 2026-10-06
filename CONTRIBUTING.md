# Contributing

## Setup

```sh
bun install          # Bun 1.4.2 (pinned in package.json)
bun run shelf -- status   # run the CLI from source
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
