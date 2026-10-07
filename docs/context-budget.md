# Context budget

What skills cost in an agent's context, and how to keep that cost down: what loads at session start and what loads on use, `shelf insights`, `shelf suggest`, and when keeping a skill is worth it.

## What loads when

Agents see skills in two steps:

| When | What loads | Cost per skill |
|---|---|---|
| Every session start | The name and description of every skill available to the agent | Small, but paid in every session of every project that has the skill |
| When the agent uses the skill | The full SKILL.md (and any reference files it reads) | Larger, paid only when it helps |

So the cost that adds up is the session cost: every borrowed skill, and every user-level skill in folders like `~/.claude/skills`, adds its description to every session. shelf's due dates exist to stop that list growing forever.

Token counts in shelf are estimates: characters divided by 4, rounded up. They are good for comparing skills and projects, not exact counts.

## shelf insights

Inside a project, `shelf insights` shows that project:

```console
$ shelf insights
billing-api: ~226 tokens of skill descriptions load at every session start
  ~136 from skills loaded everywhere (shelf, frontend-design, web-research)
  ~90 from 4 borrowed skills; the full SKILL.md loads only when used

SKILL           SESSION  ON USE  ACTIVE DAYS (30D)  LAST USED
api-design      ~25      ~127    10                 today
sql-migrations  ~25      ~127    3                  2d ago
release-notes   ~21      ~114    1                  9d ago
git-hygiene     ~19      ~129    0                  never

Every project and library skill: shelf insights --all
```

| Column | Meaning |
|---|---|
| SESSION | Name plus description of the revision the project holds. |
| ON USE | The whole SKILL.md. |
| ACTIVE DAYS (30D) | Days in the last 30 (UTC) on which an agent used the skill in this project. |
| LAST USED | The last recorded use in this project. |

"Skills loaded everywhere" are the user-level skills found in every harness's user skill directory (`~/.claude/skills`, `~/.agents/skills`, `~/.copilot/skills`, `~/.config/opencode/skills` and the rest). A skill present in several of them counts once.

Outside a project, or with `--all`, it shows every project and every library skill:

```console
$ shelf insights --all
Context at session start (skill names and descriptions; tokens estimated as chars / 4)
PROJECT      TOTAL  BORROWED  EVERYWHERE  SKILLS
storefront   ~244   ~108      ~136        4
billing-api  ~226   ~90       ~136        4
mobile-app   ~194   ~58       ~136        2
docs-site    ~179   ~43       ~136        2

Library skills, last 30 days
SKILL                 ACTIVE DAYS  LAST USED  PROJECTS  SESSION  ON USE  
react-best-practices  12           today      2         ~37      ~195    
api-design            10           today      1         ~25      ~127    
playwright-testing    3            1d ago     1         ~27      ~143    
release-notes         3            today      3         ~21      ~114    
sql-migrations        3            2d ago     1         ~25      ~127    
accessibility-audit   2            18d ago    1         ~25      ~122    
commit-messages       0            never      0         ~20      ~48     never used
git-hygiene           0            never      2         ~19      ~129    never used
pdf-tools             0            34d ago    1         ~22      ~116    unused 30d

Loaded everywhere (every session, every project): shelf ~66, frontend-design ~50, web-research ~20
```

`never used` means no use was ever recorded for the skill; `unused 30d` means none in the last 30 days. Both are candidates for returning. Usage comes from the hooks, so without hooks (or `shelf used`), every skill looks unused.

The dashboard's **Insights** page shows the same data with a per-project bar, a 30-day chart of skills used per day, and a sortable skills table.

## shelf suggest

```console
$ shelf suggest
SKILL               WHY                                       SESSION COST
pdf-tools           package.json depends on pdf-lib           ~22 tok
playwright-testing  package.json depends on @playwright/test  ~27 tok

Borrow one with `shelf borrow <skill>`.
```

`suggest` reads what the project is built with and matches it against library skills it doesn't borrow yet:

- **Dependencies** from `package.json` (dependencies and devDependencies), `pyproject.toml` (PEP 621, dependency groups, Poetry), `requirements*.txt`, `Cargo.toml` and `go.mod`.
- **Well-known files and folders**: `convex/`, `supabase/`, `migrations/`, `prisma/schema.prisma`, `.github/workflows`, `playwright.config.*`, `next.config.*`, `tailwind.config.*`, `vite.config.*`, `vitest.config.*`, `drizzle.config.*`, `Dockerfile` or `compose.yaml`, `Cargo.toml`, `pyproject.toml`, `go.mod`.

It reads the project root, its direct subdirectories, and packages under `packages/`, `apps/`, `services/`, `libs/`, `crates/` and `modules/` (at most 64 directories). A term matching a word of a skill's name ranks above one appearing in its description. Common terms (`typescript`, `eslint`, `react-dom`, `@types/*` and others) are ignored. It never uses the network.

Suggestions are hints for you. Borrow what the work at hand needs, not everything that matches.

## When to keep

A kept skill never expires, so its description loads into every session from then on. Keep a skill only when it covers something the project is built on: the framework, database or platform in its manifest. For example, Convex skills in a project whose `package.json` depends on `convex`.

Don't keep a skill because a task touched it once, or "just in case". An ordinary loan renews itself whenever it is used, so a skill the project really uses never expires anyway. Agents follow the same rule and say which dependency in `--reason`.

## Reducing the cost

- Return skills that show `never used` or `unused 30d`: `shelf return <name>`. Or let them expire.
- Shorten long descriptions. `shelf lint` warns above 300 characters.
- Move skills out of user-level folders (which load in every project) into your library, and borrow them where they are needed. See [Migrating](migrating.md).
- Lower `loanDays` in the [config](configuration.md), or a skill's own length with `shelf loan-days <name> 14`, so unused skills leave sooner. Skills in use still renew themselves.

## Related

- [`shelf insights`](cli/insights.md), [`shelf suggest`](cli/suggest.md), [`shelf keep`](cli/keep.md)
- [Writing skills](writing-skills.md#what-a-skill-costs)
