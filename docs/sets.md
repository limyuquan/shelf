# Sets

Sets are named groups of library skills that you borrow together in one step, such as `frontend` for your React, Playwright and accessibility skills. This page covers creating, nesting, borrowing and deleting them.

## Create a set

```console
$ shelf set save frontend react-best-practices playwright-testing -d "UI work in React apps"
Saved frontend (2 skills): playwright-testing, react-best-practices
Borrow it with `shelf borrow @frontend`
```

Set names follow the skill-name rules (lowercase letters, digits and single hyphens). Every skill must be in the library. `-d` sets a description; without it, an existing set keeps its description.

Saving a set that exists replaces its skills. To add one skill, save the set again with the full list.

## Build on another set

A skill argument starting with `@` includes every skill of another set:

```console
$ shelf set save web @frontend api-design
Saved web (3 skills): api-design, playwright-testing, react-best-practices
```

The set stores the expanded list of skills, not a reference: changing `frontend` later doesn't change `web`.

## List sets

```console
$ shelf set list
NAME      SKILLS                                                        DESCRIPTION
backend   api-design, git-hygiene, sql-migrations                       
frontend  accessibility-audit, playwright-testing, react-best-practic…  UI work in React apps
```

Archived skills are left out of a set's list.

## Borrow a set

```console
$ shelf borrow @frontend
Borrowed playwright-testing (due 2026-11-06) → .agents/skills, .claude/skills
Borrowed react-best-practices (due 2026-11-06) → .agents/skills, .claude/skills
```

Each skill becomes an ordinary loan with its own due date, renewals and lockfile entry. Nothing about the set reaches the project: returning one skill doesn't affect the others, and the lockfile never mentions sets. You can mix sets and skills: `shelf borrow @frontend pdf-tools`. `shelf keep @frontend` keeps every skill of the set that the project borrows.

## Delete a set

```console
$ shelf set delete web
Deleted the set web
```

Deleting a set never touches loans or skills.

## Where sets live

Sets are stored in your database (`~/.shelf/shelf.db`), like your library, so they are per machine. Agents use sets only when you name one; the guide tells them not to create or change sets unless asked.

In the dashboard, the Library page has a **Sets** section to create, edit and delete sets, and the borrow dialog has a chip per set.

## Related

- [`shelf set`](cli/set.md), [`shelf borrow`](cli/borrow.md)
