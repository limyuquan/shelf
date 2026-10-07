# shelf scan

Finds skill copies under a directory and groups them by name and content, showing duplicates, drifted versions, which versions the library already knows, and which copies shelf already manages. It changes nothing.

<!-- generated:cli scan -->
<!-- /generated -->

## What it does

Walks the directory (default: the working directory) up to `--depth` levels (default 6) and collects every folder that has a `SKILL.md` and sits directly inside a directory named `skills`. It skips your shelf home and directories that never hold project skills: `.git`, `.hg`, `.svn`, `node_modules`, `.pnpm-store`, `.yarn`, `bower_components`, `vendor`, `Pods`, `.venv`, `venv`, `__pycache__`, `.tox`, `.mypy_cache`, `.pytest_cache`, `site-packages`, `dist`, `build`, `out`, `target`, `coverage`, `.next`, `.nuxt`, `.svelte-kit`, `.turbo`, `.parcel-cache`, `.gradle`, `.terraform`, `.cache`, `.npm`, `.bun`, `.cargo`, `.rustup`, `.local`, `.Trash`, `Library`. Unreadable directories are skipped.

Copies are grouped by skill name (the folder name), then by content hash. Groups with the most copies come first; within a group, the most common version comes first.

| Mark | Meaning |
|---|---|
| `in library` | The library has a skill with this name. |
| `(library latest)` | This version is the library's latest revision. |
| `(old library revision)` | This version matches an earlier library revision. |
| `[managed]` | This copy is tracked by its project's lockfile. |

## Examples

```console
$ shelf scan ~/code
brand-voice  3 copies, 2 version(s)
  ff3ffb1a29
    ~/code/analytics/.claude/skills/brand-voice
    ~/code/analytics/.agents/skills/brand-voice
  3b83bd78e1
    ~/code/marketing-site/.claude/skills/brand-voice
git-hygiene  2 copies, 1 version(s), in library
  174f0076e3 (library latest)
    ~/code/storefront/.claude/skills/git-hygiene  [managed]
    ~/code/storefront/.agents/skills/git-hygiene  [managed]

Adopt a copy into the library and manage its project's copies: shelf adopt <path>
```

With nothing found: `No skills found under /home/me/code.`

## JSON output

Trimmed to one group:

```json
{"schemaVersion":1,"ok":true,"data":{"root":"/home/me/code","groups":[{"name":"brand-voice","inLibrary":false,"copies":3,"variants":[{"revision":"sha256:ff3ffb1a290542e9fe367ae6c31572e5303f7cac233c8f391e3bed2535f33d24","isLibraryLatest":false,"inLibraryHistory":false,"copies":[{"path":"/home/me/code/analytics/.claude/skills/brand-voice","root":"/home/me/code/analytics","target":".claude/skills","managed":false},{"path":"/home/me/code/analytics/.agents/skills/brand-voice","root":"/home/me/code/analytics","target":".agents/skills","managed":false}]},{"revision":"sha256:3b83bd78e1501af78c4e5ac94330b56f22e95498922006b99d4adb5b6cd6b3b4","isLibraryLatest":false,"inLibraryHistory":false,"copies":[{"path":"/home/me/code/marketing-site/.claude/skills/brand-voice","root":"/home/me/code/marketing-site","target":".claude/skills","managed":false}]}]}]}}
```

| Field | Meaning |
|---|---|
| `root` | The directory scanned. |
| `groups[].variants[]` | One per distinct content: `revision` (its hash), `isLibraryLatest`, `inLibraryHistory`, `copies[]`. |
| `copies[].root`, `target` | The project root and harness directory, when the copy sits in `<root>/.<harness>/skills/`; otherwise `null`. |
| `copies[].managed` | Whether that project's lockfile tracks this copy. |

## Errors

| Code | When |
|---|---|
| `INVALID_ARGUMENT` | The directory doesn't exist, or `--depth` isn't a positive integer. |

## Related

- [Migrating](../migrating.md)
- [`shelf adopt`](adopt.md)
