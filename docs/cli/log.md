# shelf log

Lists a skill's revisions, most recent first, with their date and source, and which projects hold each one. It shows at a glance who is behind.

<!-- generated:cli log -->
<!-- /generated -->

## What it does

Reconciles the library, then lists every recorded revision of the skill. `*` marks the library's latest. `BORROWED BY` lists the projects whose loan is based on that revision. Revisions are never deleted, so the list is the complete history.

| Source | Recorded when |
|---|---|
| `library` | The library copy changed (an edit, `shelf new`, `shelf restore`). |
| `promote` | A project's edits were published. |
| `import` | `shelf add` or `shelf pull`. |
| `adopt` | `shelf adopt --unedited` recorded an older copy. |

## Examples

```console
$ shelf log pdf-tools
REVISION      DATE        SOURCE   BORROWED BY
d4deea4b55 *  2026-10-07  promote  storefront
ddad27dd34    2026-10-07  library  billing-api
```

Here `billing-api` is behind: `shelf propagate pdf-tools`, or `shelf update pdf-tools` inside it, brings it to `d4deea4b55`.

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"skill":"pdf-tools","revisions":[{"hash":"sha256:d4deea4b55d45984ad84b4ea9db4211166df58840a9a66b02530604b34a4f20c","parent":"sha256:ddad27dd34082032a0f9564e301c57903aeb482c1f97b56b07844301a222bc36","source":"promote","createdAt":"2026-10-07T05:34:39.082Z","latest":true,"borrowers":["storefront"]},{"hash":"sha256:ddad27dd34082032a0f9564e301c57903aeb482c1f97b56b07844301a222bc36","parent":null,"source":"library","createdAt":"2026-10-07T05:33:58.052Z","latest":false,"borrowers":["billing-api"]}],"borrowers":[{"project":"billing-api","path":"/home/me/code/billing-api","revision":"sha256:ddad27dd34082032a0f9564e301c57903aeb482c1f97b56b07844301a222bc36","onLatest":false,"dueAt":"2026-11-06T05:34:38.125Z"},{"project":"storefront","path":"/home/me/code/storefront","revision":"sha256:d4deea4b55d45984ad84b4ea9db4211166df58840a9a66b02530604b34a4f20c","onLatest":true,"dueAt":"2026-11-06T05:34:17.892Z"}]}}
```

| Field | Meaning |
|---|---|
| `revisions[]` | `hash`, `parent`, `source`, `createdAt`, `latest`, and `borrowers` (project names). |
| `borrowers[]` | Every project borrowing the skill: `project`, `path`, `revision`, `onLatest`, `dueAt`. |

## Errors

| Code | When |
|---|---|
| `SKILL_NOT_FOUND` | No skill by that name in the library. |

## Related

- [`shelf show --revision`](show.md), [`shelf diff`](diff.md), [`shelf restore`](restore.md), [`shelf propagate`](propagate.md)
