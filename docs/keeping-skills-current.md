# Keeping skills current

How changes move between the library and projects: updating loans to the library's latest revision, promoting a project's edits, propagating to every borrower, comparing versions, restoring old revisions, and resolving local edits.

Changes never move on their own (except for loans borrowed with `--follow`). The library and each project keep their version until you run one of the commands below.

```
library ── update (in a project) ─────────▶ one project
library ── propagate (from anywhere) ─────▶ every borrowing project
project ── promote ───────────────────────▶ library
```

## Change a skill in the library

Edit `~/.shelf/library/<name>/` with any editor, or use the dashboard's skill editor. The next shelf command records the change as a new revision. Projects that borrow the skill become `behind`:

```console
$ shelf status
mobile-app  /home/me/code/mobile-app

SKILL                 CONTENT  DUE                   USED    POLICY  REVISION
react-best-practices  behind   2026-11-04  28d left  2d ago  pinned  0ee0a9e94c
release-notes         current  2026-10-22  15d left  never   pinned  0b01b7e535

Next steps:
  shelf update react-best-practices
      The library has a newer revision of react-best-practices
```

## Update a project

Inside the project:

```console
$ shelf update api-design
api-design: updated to e09cc9a0ed
```

With no names, `shelf update` updates every loan and skips the ones with local edits instead of failing:

```console
$ shelf update
api-design: already at e09cc9a0ed
pdf-tools: updated to ddad27dd34
```

Naming a skill whose copy has local edits fails with `LOCAL_CHANGES`; add `--force` to discard the edits and take the library's revision.

## Propagate to every project

From anywhere, push the library's latest revision to every project that borrows the skill:

```console
$ shelf propagate pdf-tools --dry-run
pdf-tools → dca5f929e7 (dry run)
  billing-api: would update
  storefront: would update

$ shelf propagate pdf-tools
pdf-tools → dca5f929e7
  billing-api: updated
  storefront: updated
```

Each project is reported as `updated`, `already current`, `skipped (local edits)` or `skipped (directory missing)`. Copies with local edits are never overwritten. `--project billing-api,storefront` limits it to some projects (by name, path or id).

## Promote a project's edits

When an agent improves a borrowed skill inside a project, the loan becomes `modified`:

```console
$ shelf status
storefront  /home/me/code/storefront

SKILL       CONTENT   DUE                   USED   POLICY  REVISION
api-design  current   2026-12-08  63d left  never  pinned  e09cc9a0ed
pdf-tools   modified  2026-11-06  30d left  today  pinned  ddad27dd34

Next steps:
  shelf promote pdf-tools
      pdf-tools has local edits. Promote them to the library, keep them unmanaged with `shelf detach pdf-tools`, or discard them with `shelf update pdf-tools --force`
```

Review the edits, then publish them:

```console
$ shelf diff pdf-tools
--- a/SKILL.md
+++ b/SKILL.md
@@ -5,4 +5,6 @@
 
 # pdf-tools
 
 Describe when and how an agent should apply this skill.
+
+- Prefer pdftotext for scanned files

$ shelf promote pdf-tools
Promoted pdf-tools: library ddad27dd34 → d4deea4b55
```

The edited copy becomes the library's latest revision (source `promote`), and every copy in this project is rewritten from it. Add `--propagate` to update every other borrowing project in the same step:

```console
$ shelf promote api-design --propagate
Promoted api-design: library e09cc9a0ed → d74c95b92c
api-design → d74c95b92c
  billing-api: updated
  storefront: already current
```

`promote` refuses when:

| Situation | Error | Way out |
|---|---|---|
| The copy has no edits (`current` or `behind`) | `INVALID_ARGUMENT` | Nothing to promote. |
| Copies are missing | `CONFLICT` | `shelf sync` first. |
| The library changed since the project borrowed (`diverged`) | `CONFLICT` | Review, then `--force` to replace the library's newer revision. |
| The copies in different targets were edited differently | `CONFLICT` | Make them identical, then promote. |
| The edited SKILL.md is not a valid skill | `INVALID_SKILL` | Fix the frontmatter. |

## Local edits: your three choices

A `modified` loan always has three ways forward:

| Command | Result |
|---|---|
| `shelf promote <name>` | The edits go to the library, for every project. |
| `shelf detach <name>` | The edits stay in this project only, as unmanaged files. shelf stops tracking the skill here. |
| `shelf update <name> --force` | The edits are discarded and the copy gets the library's latest revision. |

A `diverged` loan was edited here and in the library. Compare both sides before choosing:

```sh
shelf diff <name>                                # this project's edits (borrowed → project)
shelf diff <name> --from borrowed --to library   # what changed in the library
```

Then keep this project's version with `shelf promote <name> --force`, or take the library's with `shelf update <name> --force`. To combine both, edit the library copy by hand, then `shelf update <name> --force` in the project.

## Compare versions

`shelf diff <name>` compares two versions of a skill. Each side is one of:

| Side | Meaning |
|---|---|
| `borrowed` | The revision this project borrowed. |
| `library` or `latest` | The library's latest revision. |
| `project` | This project's copy on disk (the edited one, if any). |
| a revision | A hash or unique prefix of at least 6 characters (see `shelf log`). |

Without `--from` and `--to`, inside a project that borrows the skill, it shows the local edits if the copy is edited, otherwise what the library changed since the project borrowed. Outside a project, it shows the latest library change.

## Revision history

```console
$ shelf log pdf-tools
REVISION      DATE        SOURCE   BORROWED BY
d4deea4b55 *  2026-10-07  promote  storefront
ddad27dd34    2026-10-07  library  billing-api
```

`*` marks the latest revision. `shelf show <name> --revision <hash>` prints an old revision.

## Restore an earlier revision

```console
$ shelf restore pdf-tools ddad27dd34
Restored pdf-tools to rev ddad27dd34 (was d4deea4b55).
Projects that borrow it keep their revision until they update:
  shelf propagate pdf-tools
```

`restore` copies the snapshot back over the library copy and makes it the latest again. Unrecorded library edits are recorded first, so nothing is lost; every revision stays in the history. Borrowers change only when they update.

## Related

- [Borrowing](borrowing.md)
- [Writing skills](writing-skills.md)
- [`shelf update`](cli/update.md), [`shelf promote`](cli/promote.md), [`shelf propagate`](cli/propagate.md), [`shelf diff`](cli/diff.md), [`shelf log`](cli/log.md), [`shelf restore`](cli/restore.md)
