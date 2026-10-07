# shelf suggest

Suggests library skills that match what this project is built with: its dependencies and well-known files, such as `package.json` depending on `@playwright/test`, or a `convex/` folder. It lists the reason and the session cost of each.

<!-- generated:cli suggest -->
<!-- /generated -->

## What it does

Reads, with no network and bounded effort, the project root, its direct subdirectories and the packages under `packages/`, `apps/`, `services/`, `libs/`, `crates/` and `modules/` (at most 64 directories):

| Signal | Source |
|---|---|
| Dependencies | `package.json` (dependencies, devDependencies), `pyproject.toml` (PEP 621, dependency groups, Poetry), `requirements*.txt`, `Cargo.toml`, `go.mod` |
| Folders | `convex/`, `supabase/`, `migrations/`, `prisma/` (with `schema.prisma`), `.github/workflows` |
| Files | `playwright.config.*`, `next.config.*`, `tailwind.config.*`, `vite.config.*`, `vitest.config.*`, `drizzle.config.*`, `Dockerfile`, `compose.yaml` / `docker-compose.yml`, `Cargo.toml`, `pyproject.toml`, `requirements*.txt`, `go.mod` |

Each dependency also contributes the name a skill would use for it: the scope (`@playwright/test` gives `playwright`), a Go module's last path element, or the first word (`drizzle-orm` gives `drizzle`, matched against names only). Common terms (`typescript`, `eslint`, `prettier`, `react-dom`, `@types/*`, `test`, `utils` and others) are ignored.

Terms are matched against library skills the project doesn't borrow: a term naming a word of the skill's name scores 10, a whole word in its description 3. Results are sorted by score, then name. `--limit` caps the list (default 8).

Suggestions are hints. Borrow what the work at hand needs.

## Examples

```console
$ shelf suggest
SKILL               WHY                                       SESSION COST
pdf-tools           package.json depends on pdf-lib           ~22 tok
playwright-testing  package.json depends on @playwright/test  ~27 tok

Borrow one with `shelf borrow <skill>`.
```

With nothing to suggest: `No suggestions: nothing in this project matches a library skill.`

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"project":{"id":"da6c4e70-e25d-4d10-a389-b6ed7360fa5a","path":"/home/me/code/storefront","name":"storefront","createdAt":"2026-10-07T05:34:17.349Z","lastSeenAt":"2026-10-07T05:34:17.349Z"},"suggestions":[{"skill":"playwright-testing","description":"Write reliable Playwright end-to-end tests. Use when adding or fixing browser tests.","score":10,"reasons":["package.json depends on @playwright/test"],"descriptionTokens":26}]}}
```

| Field | Meaning |
|---|---|
| `suggestions[].score` | Rank (10 per name match, 3 per description match). |
| `suggestions[].reasons` | Up to three, in words. |
| `suggestions[].descriptionTokens` | Session cost of borrowing it (name plus description). |

## Errors

| Code | When |
|---|---|
| `NOT_INITIALIZED` | Not inside a shelf project. |
| `INVALID_ARGUMENT` | `--limit` isn't a positive integer. |

## Related

- [Context budget](../context-budget.md#shelf-suggest)
- [`shelf borrow`](borrow.md), [`shelf insights`](insights.md)
- Project pages in the dashboard show the same suggestions.
