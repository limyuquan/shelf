# shelf adopt

Imports existing skill directories into the library and manages their projects' copies as loans. It never overwrites a library skill: copies that differ become loans with local edits, unless they match an earlier revision or you pass `--unedited`.

<!-- generated:cli adopt -->
<!-- /generated -->

## What it does

For each path, in the order given:

1. Reads its SKILL.md (the skill's name comes from the frontmatter).
2. If the library has no skill of that name, copies the directory in: it becomes the library version (`imported`). **The first copy adopted wins**, so adopt the best or newest copy first.
3. Otherwise compares it with the library:
   - identical to the latest revision: `matched`;
   - identical to an earlier revision: `older`;
   - different, with `--unedited`: recorded as an older revision (source `adopt`), so also `older`;
   - different, without `--unedited`: `differs`.
4. If the directory is a project copy (`<root>/.<harness>/skills/<name>`), registers the project (creating its lockfile if needed) and creates a pinned loan for it with a fresh loan period. Its targets are the project's targets plus the copy's own directory; targets without a copy get this copy's content. An `older` loan starts from the copy's own revision, so it is `behind`; a `differs` loan is `modified`.
5. Audits the copy and reports findings for review. Adopting is never blocked.

No loan is created for a copy outside a project skill directory, or in a project nested inside another shelf project; the result says why. A copy that is already a loan is reported as `already borrowed by`.

Agents adopt only when you ask: it changes the library.

## Examples

```console
$ shelf adopt ~/code/marketing-site/.claude/skills/brand-voice ~/code/analytics/.claude/skills/brand-voice
brand-voice: imported into the library
  now borrowed by marketing-site (current)
brand-voice: differs from the library (kept as local edits; if it is only an older version, `shelf update --force` replaces it)
  now borrowed by analytics (modified)
```

For copies that were never edited and only differ because they were installed at different times, adopt the newest first with `--unedited`; the others become `behind` and `shelf update` brings them up to date.

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skills":[{"path":"/home/me/code/marketing-site/.claude/skills/brand-voice","skill":"brand-voice","library":"matched","revision":"sha256:3b83bd78e1501af78c4e5ac94330b56f22e95498922006b99d4adb5b6cd6b3b4","findings":[],"loan":{"project":"marketing-site","status":"already-borrowed","content":"current"},"note":null}]}}
```

| Field | Meaning |
|---|---|
| `library` | `imported`, `matched`, `older` or `differs`. |
| `revision` | The revision the loan starts from. |
| `loan` | `{ project, status: "created" \| "already-borrowed", content }`, or `null`. |
| `note` | Why no loan was created, when `loan` is `null`. |
| `findings[]` | Audit findings (see [`shelf audit`](audit.md#json-output)). |

## Errors

| Code | When |
|---|---|
| `INVALID_ARGUMENT` | No paths, or a path inside the shelf home. |
| `INVALID_SKILL` | A path has no SKILL.md, or its frontmatter is invalid (including a `name` that doesn't match the directory). |
| `CONFLICT` | The project's lockfile is invalid. |

## Related

- [Migrating](../migrating.md)
- [`shelf scan`](scan.md), [`shelf promote`](promote.md), [`shelf update`](update.md)
