# shelf insights

Shows how many tokens of skill descriptions each project loads at every session start, and which skills agents actually used in the last 30 days. Inside a project it shows that project; outside, or with `--all`, every project and library skill.

<!-- generated:cli insights -->

```text
shelf insights [options]
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--all` | boolean |  | Every project and skill, even inside a project |

Also takes the global options `--json` and `--actor` ([CLI overview](index.md)).

<!-- /generated -->

## What it does

Reads, never changes: it doesn't sync or expire anything.

- **Session cost** of a skill is its name plus description (characters / 4, rounded up), from the revision the project actually holds.
- **On use** cost is the whole SKILL.md.
- **Loaded everywhere** are the valid skills in every harness's user-level skill directory (`~/.claude/skills`, `~/.agents/skills`, `~/.copilot/skills` and the others in [Harnesses](../harnesses.md#harness-ids)), counted once each. They load in every project.
- **Active days** count the UTC days in the last 30 on which a use was recorded (by the hooks or `shelf used`).

Projects whose directory no longer exists are left out.

## Examples

Inside a project:

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

Everywhere:

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

`never used`: no use was ever recorded. `unused 30d`: none in the last 30 days.

## JSON output

The JSON is the same with or without `--all`. Trimmed to one item per array, and `daily` to its last value:

```json
{"schemaVersion":1,"ok":true,"data":{"globalSkills":[{"name":"shelf","harnessDirs":[".agents/skills",".claude/skills"],"descriptionTokens":66,"bodyTokens":255,"bundled":true}],"invalidGlobalSkills":0,"projects":[{"id":"271949f0-7dc1-437e-93b2-ccb03cfec021","name":"billing-api","path":"/home/me/code/billing-api","skills":[{"skill":"api-design","descriptionTokens":33,"bodyTokens":83,"lastUsedAt":null,"activeDays30":0}],"sessionTokens":68,"globalTokens":66}],"skills":[{"name":"api-design","descriptionTokens":33,"bodyTokens":83,"borrowers":2,"activeDays30":0,"lastUsedAt":null,"neverUsed":true,"daily":[0]}],"usage":{"days":["2026-10-07"],"active":[2]},"currentProject":null}}
```

| Field | Meaning |
|---|---|
| `globalSkills[]` | User-level skills: `name`, `harnessDirs` (relative to home), `descriptionTokens`, `bodyTokens`, `bundled` (shelf's own skill). |
| `invalidGlobalSkills` | User-level skill directories with an invalid SKILL.md, left out. |
| `projects[]` | `id`, `name`, `path`, `skills[]` (`skill`, `descriptionTokens`, `bodyTokens`, `lastUsedAt`, `activeDays30`), `sessionTokens` (borrowed), `globalTokens` (loaded everywhere). |
| `skills[]` | Every library skill: `name`, `descriptionTokens`, `bodyTokens`, `borrowers`, `activeDays30`, `lastUsedAt`, `neverUsed`, `daily` (projects using it on each of the 30 days, oldest first). |
| `usage.days` | The 30 UTC dates, oldest first; the last is today. |
| `usage.active` | Distinct skills used on each day. |
| `currentProject` | The project containing the working directory (same shape as `projects[]`), or `null`. |

## Errors

None specific to this command.

## Related

- [Context budget](../context-budget.md)
- [`shelf suggest`](suggest.md), [`shelf keep`](keep.md)
