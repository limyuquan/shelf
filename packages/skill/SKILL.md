---
name: shelf
description: Manage this project's agent skills from the user's personal skill library with the `shelf` CLI (borrow, renew, return, update, promote). Use when a `shelf:` note appears, when the user asks about skills, or when a task needs a skill the project does not have.
---

Borrowed skills renew automatically when used and are returned after going unused. A `shelf:` note at session start means something needs attention: act on it.

- Need a capability? `shelf catalog <terms> --json`, check it with `shelf show <name>`, then `shelf borrow <name>`.
- Due soon but still needed: `shelf renew <name> --reason "<why>"`. No longer needed: `shelf return <name>`.
- Improved a borrowed skill? `shelf promote <name>` publishes it to the library. Library changed? `shelf update <name>`.
- Never hand-edit or delete skill copies to change them everywhere; shelf tracks them by hash.

`shelf status --json` lists every loan with next steps. Errors include a `hint` with the fix. Full guide: `shelf guide`.
