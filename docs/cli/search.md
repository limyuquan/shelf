# shelf search

Finds library skills by what they say: their names, descriptions, SKILL.md bodies and text reference files, with the matching lines. Use it when a skill's name and description don't reveal what it covers.

<!-- generated:cli search -->
<!-- /generated -->

## What it does

Every term must appear somewhere in the skill (name, description, SKILL.md or a reference file), case-insensitively. An argument with spaces, which is what the shell passes for a quoted phrase, is matched as a phrase: `shelf search "error envelope"`.

Results are ranked: a hit in the name outranks any number of hits in the description, which outrank the body, then reference files. Each result shows up to three matching lines (`file:line` and a snippet). There is no index; every search reads the library, which takes milliseconds for a personal library.

`--limit` caps the number of skills listed (default 10).

## Examples

```console
$ shelf search errors code
api-design  Design HTTP APIs: resource naming, error envelopes, pagination and ve…
  SKILL.md:12  Return errors as { "error": { "code", "message" } }.
  SKILL.md:10  ## Errors

$ shelf search pagination
api-design  Design HTTP APIs: resource naming, error envelopes, pagination and ve…
```

A skill that matches only in its name or description is listed without lines. With no match: ``No skill mentions that. Try fewer terms, or `shelf catalog` to list every skill.``

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"query":"\"error envelope\"","results":[{"name":"api-design","description":"Design HTTP APIs: resource naming, error envelopes, pagination and versioning. Use when adding or changing API endpoints.","score":30,"matches":[]}]}}
```

| Field | Meaning |
|---|---|
| `query` | The query as shelf parsed it (phrases quoted). |
| `results[].name`, `description` | The skill. |
| `results[].score` | Rank; only meaningful relative to other results of the same search. |
| `results[].matches[]` | Up to 3 lines: `file` (relative to the skill), `line` (1-based), `snippet` (about 120 characters around the hit, `…` where cut) and `ranges` (`[start, end)` offsets of the hits in the snippet). |

## Errors

| Code | When |
|---|---|
| `INVALID_ARGUMENT` | No terms, or `--limit` isn't a positive integer. |

## Related

- [`shelf catalog`](catalog.md) filters by name and description only.
- The dashboard's Library filter and ⌘K use the same search.
