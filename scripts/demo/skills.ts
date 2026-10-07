/** Sample skills for the demo library: realistic enough to screenshot. */
export interface DemoSkill {
  readonly name: string;
  readonly description: string;
  /** SKILL.md below the frontmatter. */
  readonly body: string;
  /** Reference files, by path relative to the skill folder. */
  readonly files?: Record<string, string>;
}

export const DEMO_SKILLS: DemoSkill[] = [
  {
    name: "react-best-practices",
    description:
      "Component structure, hooks rules and rendering performance for React 19 apps. Use when writing, reviewing or refactoring React components.",
    body: `# React best practices

Conventions for React 19 function components. Read the component and its
callers before changing either.

## Structure

1. Name components after what they render (\`InvoiceRow\`, not \`RowItem\`).
2. Keep one component per file once it passes ~150 lines.
3. Colocate data fetching with the route that needs it; pass data down, not fetchers.

## State

- Derive values during render instead of syncing them with \`useEffect\`.
- Lift state only as far as the closest common parent.
- Reach for a reducer when three or more \`useState\` calls change together.

## Hooks

- Never call hooks conditionally or inside loops.
- Every effect needs a cleanup if it subscribes, listens or starts a timer.
- Custom hooks start with \`use\` and return the smallest useful API.
`,
  },
  {
    name: "playwright-testing",
    description:
      "Write reliable end-to-end tests with Playwright: role-based locators, fixtures and web-first assertions. Use when adding or fixing browser tests.",
    body: `# Playwright testing

## Writing a test

1. Start from the user journey, one journey per test.
2. Locate elements by role and accessible name: \`getByRole("button", { name: "Pay" })\`.
3. Assert with web-first assertions (\`await expect(locator).toBeVisible()\`); they retry.
4. Put shared setup in fixtures, not \`beforeEach\` chains.

## Avoiding flakes

- No \`waitForTimeout\`. Wait for a state the user could see.
- Seed data through the API, not the UI, and give each test its own data.
- Run new tests with \`--repeat-each=20\` before merging.

## Debugging

\`\`\`sh
npx playwright test checkout.spec.ts --trace on
npx playwright show-trace test-results/**/trace.zip
\`\`\`
`,
  },
  {
    name: "accessibility-audit",
    description:
      "Audit web interfaces against WCAG 2.2: keyboard access, focus order, contrast, labels and motion. Use when reviewing UI changes or before a release.",
    body: `# Accessibility audit

Work through each flow the change touches. Report issues with the WCAG
criterion, the element and a suggested fix.

## Checklist

1. **Keyboard**: every control is reachable with Tab and works with Enter/Space.
2. **Focus**: the order follows the visual order; focus is always visible.
3. **Names**: every control has an accessible name; icons have labels.
4. **Contrast**: text 4.5:1, large text and icons 3:1.
5. **Motion**: animations respect \`prefers-reduced-motion\`.
6. **Forms**: errors are announced and tied to their field.

## Tools

- axe DevTools or \`@axe-core/playwright\` for a first pass.
- A screen reader (VoiceOver, NVDA) for anything custom.

Automated checks find about a third of issues. Always test by hand too.
`,
  },
  {
    name: "api-design",
    description:
      "Design consistent HTTP APIs: resource naming, error envelopes, cursor pagination and versioning. Use when adding or changing an endpoint.",
    body: `# API design

## Resources

- Name resources as plural nouns: \`/invoices\`, \`/invoices/{id}/lines\`.
- Use HTTP verbs for actions; add a sub-resource for anything else
  (\`POST /invoices/{id}/void\`).
- IDs are opaque strings with a type prefix: \`inv_8c2f…\`.

## Responses

1. Return the resource itself, not a wrapper, on success.
2. Return one error envelope everywhere (see references/errors.md).
3. Paginate every list with opaque cursors (see references/pagination.md).

## Changes

- Never break a published response shape. Add fields; don't rename or remove them.
- Breaking changes get a new dated version (see references/versioning.md).
- Document every endpoint in the OpenAPI file in the same pull request.
`,
    files: {
      "references/errors.md": `# Error envelope

Every error response uses this shape, whatever the status code:

\`\`\`json
{
  "error": {
    "code": "invoice_not_found",
    "message": "No invoice with id inv_8c2f.",
    "hint": "Check the id, or list invoices with GET /invoices."
  }
}
\`\`\`

- \`code\` is stable and machine-readable; clients switch on it.
- \`message\` is for humans and may change.
`,
      "references/pagination.md": `# Cursor pagination

\`\`\`
GET /invoices?limit=50&cursor=eyJpZCI6Imludl84YzJmIn0
\`\`\`

- Cursors are opaque: base64 of the last row's sort key.
- \`limit\` defaults to 20 and is capped at 100.
- Responses include \`next_cursor\`, or \`null\` on the last page.
- Never paginate with offsets on tables that grow.
`,
      "references/versioning.md": `# Versioning

- Versions are dates: \`2026-06-01\`, sent in the \`Api-Version\` header.
- Each account is pinned to the version it first used.
- Keep old versions for at least twelve months after a new one ships.
`,
    },
  },
  {
    name: "sql-migrations",
    description:
      "Plan safe, reversible Postgres migrations with expand-and-contract. Use when changing a schema that serves live traffic.",
    body: `# SQL migrations

Every migration must run while the previous release is still serving traffic.

## Expand and contract

1. **Expand**: add the new column or table, nullable or with a default.
2. **Backfill** in batches of a few thousand rows, outside the migration.
3. **Switch** reads and writes to the new shape in application code.
4. **Contract**: drop the old column in a later release.

## Rules

- Every migration has a tested \`down\`.
- Create indexes \`CONCURRENTLY\`; never lock a large table.
- Set \`lock_timeout = '5s'\` at the top of each migration.
- Never rename a column in one step.
`,
  },
  {
    name: "postgres-performance",
    description:
      "Find and fix slow Postgres queries with EXPLAIN ANALYZE, indexes and query rewrites. Use when a query or an endpoint is slow.",
    body: `# Postgres performance

## Diagnose

1. Find the query: \`pg_stat_statements\` ordered by \`total_exec_time\`.
2. Run \`EXPLAIN (ANALYZE, BUFFERS)\` on production-sized data.
3. Look for sequential scans on large tables and row estimates that are far off.

## Fix

- Add a composite index that matches the \`WHERE\` and \`ORDER BY\` columns.
- Replace \`OFFSET\` pagination with keyset pagination.
- Run \`ANALYZE\` after bulk loads so the planner has fresh statistics.

Measure before and after, and put both plans in the pull request.
`,
  },
  {
    name: "git-hygiene",
    description:
      "Focused commits, clean branches and tidy history. Use when committing, rebasing or preparing a pull request.",
    body: `# Git hygiene

## Commits

1. Stage related changes only: \`git add -p\`.
2. One logical change per commit; tests go with the code they test.
3. Run the checks before committing, not after.

## Branches

- Branch from an up-to-date \`main\`.
- Rebase onto \`main\` before opening a pull request.
- Delete branches once they are merged.

## Never

- Force-push a shared branch.
- Commit secrets, \`.env\` files or build output.
`,
  },
  {
    name: "code-review",
    description:
      "Review a diff for correctness, security and readability, and leave actionable comments. Use when asked to review a pull request or a change.",
    body: `# Code review

Read the description and linked issue first, then the tests, then the code.

## What to look for

1. **Correctness**: edge cases, error paths, concurrency.
2. **Security**: input validation, authorisation checks, secrets in logs.
3. **Tests**: they fail without the change and cover the risky paths.
4. **Readability**: names, size of functions, comments that explain why.

## Comments

- Label each one: \`blocking\`, \`suggestion\` or \`question\`.
- Suggest a fix, not just a problem.
- Approve when only suggestions remain.
`,
  },
  {
    name: "release-notes",
    description: "Draft release notes from merged pull requests, grouped by user impact.",
    body: `# Release notes

1. List the pull requests merged since the last tag:
   \`gh pr list --state merged --search "merged:>=2026-09-01"\`
2. Group them: **New**, **Improved**, **Fixed**, **Breaking**.
3. Write one line per change, in the user's words, starting with a verb.
4. Link each line to its pull request.

## Rules

- Write for users, not maintainers. Skip refactors and CI changes.
- Every breaking change gets a migration note.
`,
  },
  {
    name: "pdf-tools",
    description:
      "Extract text, tables and form fields from PDFs, and fill or merge PDF files. Use when a task involves reading or producing PDFs.",
    body: `# PDF tools

## Reading

1. Check for a text layer: \`pdftotext -layout file.pdf - | head\`.
2. No text? Run OCR first: \`ocrmypdf in.pdf out.pdf\`.
3. Extract tables page by page with \`pdfplumber\`; check the column count.

## Writing

- Fill forms with \`pypdf\` (\`update_page_form_field_values\`), then flatten.
- Merge with \`qpdf --empty --pages a.pdf b.pdf -- out.pdf\`.

## Rules

- Never upload documents to third-party services.
- Keep the original file; write results next to it.
`,
  },
  {
    name: "tailwind-patterns",
    description:
      "Tailwind CSS v4 conventions: design tokens, variants and when to extract a component. Use when styling components with Tailwind.",
    body: `# Tailwind patterns

- Use theme tokens (\`bg-surface\`, \`text-fg-muted\`), never raw hex colours.
- Order classes: layout, box, typography, colour, state.
- Extract a component when the same class list appears three times.
- Use \`data-*\` and \`aria-*\` variants for state instead of conditional strings.
- Dark mode comes from tokens, not \`dark:\` on every element.
`,
  },
  {
    name: "docker-builds",
    description:
      "Small, cacheable Docker images with multi-stage builds and non-root users. Use when writing or debugging a Dockerfile.",
    body: `# Docker builds

1. Pin the base image by digest.
2. Copy dependency manifests first, install, then copy the source, so layers cache.
3. Build in one stage and copy only the output into a slim runtime stage.
4. Run as a non-root user and add a \`HEALTHCHECK\`.

Check the result with \`docker history\` and keep images under 200 MB.
`,
  },
  {
    name: "python-packaging",
    description:
      "Package Python projects with uv and pyproject.toml: dependencies, entry points and lockfiles. Use when setting up or publishing a Python package.",
    body: `# Python packaging

- One \`pyproject.toml\`; no \`setup.py\` or \`requirements.txt\`.
- Manage dependencies with \`uv add\` and commit \`uv.lock\`.
- Declare CLIs under \`[project.scripts]\`.
- Use a \`src/\` layout so tests run against the installed package.
`,
  },
  {
    name: "pytest-patterns",
    description:
      "Fast, isolated pytest suites: fixtures, parametrize and fakes over mocks. Use when writing or fixing Python tests.",
    body: `# pytest patterns

1. Name tests after behaviour: \`test_rejects_expired_token\`.
2. Use fixtures for setup and \`tmp_path\` for files.
3. Parametrize instead of copying a test.
4. Prefer small fakes to \`mock.patch\`; patch only at the boundary.

Keep the unit suite under ten seconds; mark slow tests with \`@pytest.mark.slow\`.
`,
  },
  {
    name: "react-native-performance",
    description:
      "Keep React Native screens at 60 fps: lists, images, re-renders and the JS thread. Use when a screen feels slow or janky.",
    body: `# React Native performance

1. Profile first: React DevTools profiler and the performance monitor.
2. Use \`FlashList\` for long lists, with a fixed \`estimatedItemSize\`.
3. Resize images on the server; never ship a 4000 px photo to a thumbnail.
4. Move animations to the UI thread with Reanimated.
`,
  },
  {
    name: "writing-docs",
    description:
      "Write task-focused documentation: one goal per page, runnable examples, plain words. Use when writing READMEs, guides or reference pages.",
    body: `# Writing docs

- Start each page with what the reader will be able to do.
- One goal per page; link instead of repeating.
- Every example must run as written. Test it.
- Short sentences, second person, no jargon without a definition.
`,
  },
  {
    name: "incident-postmortem",
    description:
      "Write a blameless postmortem: timeline, impact, root cause and follow-ups. Use when an incident is resolved.",
    body: `# Incident postmortem

1. **Summary**: what happened, in two sentences.
2. **Impact**: who was affected, for how long, and how badly.
3. **Timeline**: detection, response and resolution, in UTC.
4. **Root cause**: ask why until the answer is a process, not a person.
5. **Follow-ups**: each with an owner and a date.
`,
  },
];

export function renderSkill(skill: Pick<DemoSkill, "name" | "description" | "body">): string {
  // Quote only descriptions YAML would misread, as a person writing by hand would.
  const plain = !/: | #|^["'[{&*!|>%@`]/.test(skill.description);
  const description = plain ? skill.description : JSON.stringify(skill.description);
  return `---\nname: ${skill.name}\ndescription: ${description}\n---\n\n${skill.body}`;
}
