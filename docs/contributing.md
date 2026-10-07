# Contributing

How to work on shelf itself: set up the repository, run it from source against a scratch state directory, run the checks, and find your way around the code. The full conventions are in CONTRIBUTING.md.

## Set up

```sh
git clone https://github.com/limyuquan/shelf.git
cd shelf
bun install                 # Bun 1.4.2, pinned in package.json
export SHELF_HOME=$(mktemp -d)   # never develop against your real ~/.shelf
bun run shelf -- status     # the CLI from source
bun run dev                 # the dashboard on demo data; reload to see changes
```

`bun run demo` (or `bun scripts/demo/seed.ts <dir>`) builds a demo shelf with projects, loans in every state and activity from several agents, and prints the `HOME` and `SHELF_HOME` to use with it.

## Checks

```sh
bun run check                              # Biome, tsc and bun test: what CI runs
bun run format                             # apply Biome formatting
bun run build                              # compile dist/shelf
SHELF_BIN=dist/shelf bun test tests/e2e    # end-to-end tests against the binary
```

## Where things are

| Path | What |
|---|---|
| `packages/core` | All domain logic: services, loan states, the library and object store, the lockfile, SQLite. |
| `packages/cli` | The `shelf` command: each command maps arguments to one core service and renders text or JSON. `src/guide.md` is the agent guide. |
| `packages/server` | The dashboard's Hono API over the same services. |
| `packages/web` | The dashboard, a React app. |
| `packages/skill` | The bundled `SKILL.md` that `shelf setup` installs. |
| `docs/` | These docs. `docs/nav.json` orders them for the site. |

[Architecture](architecture.md) explains the design: who owns which data, content states, renew on use, the invariants and concurrency. Read it before changing code.

## Conventions

The full list is in [CONTRIBUTING.md](../CONTRIBUTING.md). In short:

- Logic lives in `packages/core/src/services`; CLI commands and API routes only map inputs and render output.
- Services take a `Context` and never read globals (environment, working directory, clock).
- Every failure a user or agent can act on is a `ShelfError` with a code and a `hint`.
- Tests use real temporary directories, not a mocked filesystem.
- Changing a command's `--json` data incompatibly means bumping `SCHEMA_VERSION`.
- Comments explain why, not what.

## Docs

Pages are Markdown in `docs/`, readable on GitHub and rendered on the site. Each starts with a `# Title` and a one-paragraph description. Blocks between `generated` HTML comment markers (CLI usage, error codes, config keys) are generated from the code by `bun run docs:gen`; edit the prose around them, never inside.

## Releasing

See the Releasing section of [CONTRIBUTING.md](../CONTRIBUTING.md#releasing).
