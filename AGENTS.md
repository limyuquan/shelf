# Agent notes

- Read docs/ARCHITECTURE.md before changing code; follow CONTRIBUTING.md conventions.
- `bun run check` must pass (Biome lint, tsc, bun test). Run `bun run format` to fix style.
- Never run shelf against the real `~/.shelf` while developing: set `SHELF_HOME=$(mktemp -d)`.
- Logic belongs in `packages/core/src/services`; CLI commands and API routes only map inputs and render output.
- The dashboard is `packages/server` (Hono API, the `Api` contract type) and `packages/web` (React, TanStack Router + Query, Tailwind tokens). See "Web app" in docs/ARCHITECTURE.md.
