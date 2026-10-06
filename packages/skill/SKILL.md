---
name: shelf
description: Manage this project's agent skills from the user's personal skill library with the `shelf` CLI (borrow, renew, return, update, promote). Use at the start of a session, and whenever a task needs a skill the project does not have.
---

At session start, run `shelf status --json` and work through `data.actions`.

- Need a capability? `shelf catalog <terms> --json`, check it with `shelf show <name>`, then `shelf borrow <name>`.
- A skill you rely on is due soon: `shelf renew <name> --reason "<why>"`. One you never used: `shelf return <name>`.
- Improved a borrowed skill? `shelf promote <name>` publishes it to the library. Library changed? `shelf update <name>`.
- Never hand-edit or delete skill copies to change them everywhere; shelf tracks them by hash.

Every command accepts `--json`; errors include a `hint` with the fix. Full guide: `shelf guide`.
