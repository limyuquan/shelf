# Migrating existing skills

How to bring skills you already copied into projects by hand under shelf: find every copy with `shelf scan`, adopt them with `shelf adopt` (or the dashboard's Find existing skills), and sort out copies that drifted apart.

## Find your copies

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

`scan` walks the directory (default: the current one, 6 levels deep, `--depth N` to change) and finds every folder with a `SKILL.md` inside a `skills` directory. It groups them by name, then by content:

- **More than one version** means the copies drifted apart.
- **(library latest)** and **(old library revision)** mark versions your library already knows.
- **[managed]** marks copies a project's lockfile already tracks.

It skips dependency, build and cache directories (`node_modules`, `vendor`, `dist`, `build`, `target`, `.venv`, `.git`, `Library` and others) and your shelf home. Scanning never changes anything.

## Adopt

```console
$ shelf adopt ~/code/marketing-site/.claude/skills/brand-voice ~/code/analytics/.claude/skills/brand-voice
brand-voice: imported into the library
  now borrowed by marketing-site (current)
brand-voice: differs from the library (kept as local edits; if it is only an older version, `shelf update --force` replaces it)
  now borrowed by analytics (modified)
```

For each path, in the order given, `adopt`:

1. Imports the skill into the library if the library has no skill of that name. The **first copy adopted becomes the library version.**
2. Compares the copy with the library otherwise, and never overwrites the library.
3. If the copy sits in a project skill directory (`<root>/.<harness>/skills/<name>`), registers the project (creating its lockfile) and turns the copy into a loan. The project's other target directories get the same content, so every copy of the loan starts identical. The loan is pinned, with a fresh loan period.
4. Audits the copy and shows any findings for review (adopting is never blocked).

Each copy gets one of four outcomes:

| Outcome | Meaning | Loan state |
|---|---|---|
| `imported` | The library had no such skill; this copy became it. | `current` |
| `matched` | The copy is identical to the library's latest revision. | `current` |
| `older` | The copy is an earlier revision the library knows, or any differing copy when adopting with `--unedited`. | `behind` |
| `differs` | The library has a different version; the copy keeps its content as local edits. | `modified` |

A copy outside a project skill directory is imported but gets no loan (`no loan: Not inside a project skill directory`). So does a copy whose project is nested inside another shelf project.

## Drifted copies

When copies differ, decide whether the differences are edits someone made, or just versions installed at different times.

**They are edits.** Adopt the best copy first, then the rest. The others become `modified` loans, so nothing is lost. In each project, review and choose:

```sh
shelf diff brand-voice                    # what this copy changed
shelf promote brand-voice --propagate     # this copy is better: publish it everywhere
shelf update brand-voice --force          # the library's is better: take it
```

**They are older versions.** If the copies were never edited and only differ because they were installed from upstream at different times, adopt the newest first with `--unedited`:

```sh
shelf adopt --unedited ~/code/marketing-site/.claude/skills/brand-voice ~/code/analytics/.claude/skills/brand-voice
```

Every other copy is then recorded as an older revision (source `adopt`), its loan is `behind`, and a plain `shelf update` brings it up to date. Agents are never invited to promote stale content.

## In the dashboard

**Library → Find existing skills** (or ⌘K, "Find existing skills") does the same with checkboxes. It scans the folder that holds your registered projects by default, groups copies by name and version, and adopts the copies you tick. Within each skill it adopts the library's (or the most common) version first. The checkbox **These copies have no local edits (older versions)** is `--unedited`. See [Dashboard](dashboard.md#find-existing-skills).

## Link to upstream

Skills that came from a public repository can be linked to it after adopting, so you can pull its updates later:

```sh
shelf add gh:owner/repo --skill brand-voice --yes
```

On a skill the library already has, this only records the source. See [Importing skills](importing-skills.md#link-a-skill-you-already-have).

## Afterwards

- Commit each project's `.agents/shelf.lock.json`.
- Run `shelf status` in each project, or open the dashboard's Attention page, to see what still needs a decision.
- User-level copies in `~/.claude/skills` and similar folders load in every project. Once a skill is in your library, consider borrowing it only where it is needed and removing the user-level copy. `shelf insights` lists them under "Loaded everywhere".

## Related

- [`shelf scan`](cli/scan.md), [`shelf adopt`](cli/adopt.md)
- [Keeping skills current](keeping-skills-current.md)
