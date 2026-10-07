# shelf docs

shelf keeps your Agent Skills in one library and lends them to the projects that need them. Loans expire, so skills nobody uses don't pile up.

```console
$ npm install -g @limyuquan/shelf
$ shelf setup
$ cd ~/code/storefront && shelf init
$ shelf borrow pdf-tools api-design
Borrowed pdf-tools (due 2026-11-06) → .agents/skills, .claude/skills
Borrowed api-design (due 2026-11-06) → .agents/skills, .claude/skills
```
