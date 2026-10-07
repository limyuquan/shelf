# shelf catalog

Lists the skills in your library with their size in tokens and their description, optionally filtered by terms that must all appear in the name or description.

<!-- generated:cli catalog -->
<!-- /generated -->

## What it does

Reconciles the library (recording revisions for edited skills), then lists every valid, non-archived skill in alphabetical order. With terms, a skill is listed only if every term (case-insensitive) appears somewhere in its name or description. Several arguments are joined into one query: `shelf catalog react testing`.

To search the content of skills (SKILL.md bodies and reference files), use [`shelf search`](search.md).

The `TOKENS` column estimates the whole SKILL.md (characters / 4): what loading the skill costs. At session start only the name and description load; see [Context budget](../context-budget.md).

## Examples

```console
$ shelf catalog
NAME                  TOKENS  DESCRIPTION
accessibility-audit   ~122    Audit interfaces for WCAG 2.2 issues: contrast, focus order, labels a…
api-design            ~127    Design consistent HTTP APIs: resource naming, error envelopes, pagina…
commit-messages       ~48     Write conventional commit messages that explain why, not what.
git-hygiene           ~129    Focused commits, clean branches and conventional commit messages.
pdf-tools             ~116    Extract text, tables and form fields from PDFs, and fill or merge PDF…
playwright-testing    ~143    Write reliable end-to-end tests with Playwright: locators, fixtures a…
react-best-practices  ~195    Component structure, hooks rules and rendering performance for React …
release-notes         ~114    Draft release notes from merged pull requests, grouped by user impact.
sql-migrations        ~127    Plan safe, reversible database migrations with expand-and-contract an…

$ shelf catalog release
NAME           TOKENS  DESCRIPTION
release-notes  ~114    Draft release notes from merged pull requests, grouped by user impact.
```

Descriptions are cut at 70 characters in text output; `--json` has them in full. With no match it prints ``No matching skills. Create one with `shelf new <name> -d <description>`.``

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skills":[{"name":"api-design","description":"Design HTTP APIs: resource naming, error envelopes, pagination and versioning. Use when adding or changing API endpoints.","revision":"sha256:d74c95b92cffd891a2c5de8a17c11ae8ed067d403dd8993f5c24e94625d29904","revisions":3,"tokens":83,"borrowers":2,"source":null,"loanDays":30,"customLoanDays":null}]}}
```

| Field | Meaning |
|---|---|
| `name`, `description` | From the frontmatter. |
| `revision` | The latest revision. |
| `revisions` | How many revisions are recorded. |
| `tokens` | SKILL.md size estimate (characters / 4, rounded up). |
| `borrowers` | Projects borrowing it now. |
| `source` | The URL or path `shelf pull` fetches from, or `null`. |
| `loanDays` | The skill's effective loan length. |
| `customLoanDays` | The length set with `shelf loan-days`, or `null` for the config default. |

## Errors

None specific to this command.

## Related

- [`shelf search`](search.md), [`shelf show`](show.md), [`shelf suggest`](suggest.md)
