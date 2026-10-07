# Configuration

shelf reads `~/.shelf/config.json`. Every key is optional; a missing file means the defaults below.

```json
{
  "$schema": "https://limyuquan.github.io/shelf/schema/config.schema.json",
  "loanDays": 21,
  "targets": [".agents/skills", ".claude/skills"]
}
```

## Keys

<!-- generated:config -->

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `loanDays` | integer | `30` | Loan length in days for `borrow`, and the default extension for `renew`. |
| `maxLoanDays` | integer | `90` | Upper bound on how far in the future a due date may be set, in days. |
| `dueSoonDays` | integer | `7` | Loans due within this many days are reported as `due-soon`. |
| `allowAgentImports` | boolean | `false` | Lets agents run `shelf add` / `shelf pull` from remote sources. Off by default: the library is the trust boundary, and only the user should widen it. |
| `hooks` | boolean | `true` | Install harness hooks (Claude Code, Codex) that renew loans when a skill is used and report loans needing attention at session start. Set by `shelf setup`. |
| `mode` | `"copy"` \| `"link"` | `"copy"` | `copy`: a copy per target. `link`: one copy, other targets symlink to it. |
| `targets` | string[] | `[".agents/skills",".claude/skills"]` | Project-relative directories that borrowed skills are written into. |

<!-- /generated -->

## Exit codes

Every command exits 0 on success. Failures carry a stable code in the `--json` envelope and set the exit code:

<!-- generated:errors -->

| Code | Exit code | Meaning |
| --- | --- | --- |
| `INTERNAL` | 1 | Anything that is not a ShelfError: a bug or an unexpected I/O error. The message says what failed. |
| `INVALID_ARGUMENT` | 2 | A missing or malformed argument, option or config value, or a request that does not apply (for example promoting a copy with no local edits). |
| `INVALID_SKILL` | 2 | A SKILL.md is missing, has no or invalid YAML frontmatter, or breaks a rule of the Agent Skills spec (name, description). |
| `NOT_INITIALIZED` | 3 | The current directory is not in a shelf project. Run `shelf init` in the project root. |
| `SKILL_NOT_FOUND` | 4 | No skill, set or source entry by that name. |
| `NOT_BORROWED` | 4 | The skill is in the library, but this project has not borrowed it. |
| `SKILL_EXISTS` | 5 | A skill or set with that name already exists. |
| `CONFLICT` | 5 | The operation would overwrite or orphan something: files shelf does not manage, a newer library revision, copies edited differently, or loans in other projects. |
| `LOCAL_CHANGES` | 6 | The project copy has local edits that the operation would discard. Promote or detach them first, or pass `--force`. |
| `LOAN_LIMIT` | 7 | The requested loan length or due date is beyond `maxLoanDays`. |
| `NOT_ALLOWED` | 8 | The actor may not do this, for example an agent importing from a remote source while `allowAgentImports` is off. |

<!-- /generated -->

See the [CLI overview](cli/index.md) for the JSON envelope.
