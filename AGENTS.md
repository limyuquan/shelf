# Agent notes

- Read docs/ARCHITECTURE.md before changing code; follow CONTRIBUTING.md conventions.
- `bun run check` must pass (Biome lint, tsc, bun test). Run `bun run format` to fix style.
- Never run shelf against the real `~/.shelf` while developing: set `SHELF_HOME=$(mktemp -d)`.
- Logic belongs in `packages/core/src/services`; CLI commands only map args and render output.
