# Importing skills

How to bring skills from outside your library into it, safely: `shelf add` from a git repository or directory, `shelf pull` for upstream updates, the local audit and its checks, what agents may and may not import, and linking skills you already have to their upstream.

Your library is the trust boundary: agents borrow only from it. Anything from outside goes through a review step first, and nothing enters the library until you pass `--yes`.

## Add a skill

```console
$ shelf add gh:someone/skills --skill release-notes
release-notes (1 file): review only — nothing imported. Re-run with --yes to import
  no findings

$ shelf add gh:someone/skills --skill release-notes --yes
release-notes (1 file): imported into the library
  no findings
```

The first run fetches the source, finds the skill, audits every file and prints the review. The second run, with `--yes`, copies it into `~/.shelf/library/<name>` as a new skill (revision source `import`) and records where it came from, so `shelf pull` can update it later.

### Sources

| Form | Example |
|---|---|
| GitHub shorthand | `gh:owner/repo`, `gh:owner/repo/path/to/skill`, `gh:owner/repo@v1.2.0` |
| GitHub tree URL | `https://github.com/owner/repo/tree/main/skills/pdf-tools` |
| Any git URL | `https://…`, `http://…`, `ssh://…`, `git@host:owner/repo.git`, `file://…` |
| A local directory | `~/Downloads/pdf-tools`, `../shared-skills` |

`--ref` (branch, tag or commit) and `--path` (the skill directory inside the source) override what the source string says.

Git sources are cloned shallowly into a temporary directory with credential prompts disabled, so a private repository needs credentials that work without a prompt (an SSH key or a credential helper). A commit that isn't a branch or tag needs a full clone, which shelf falls back to. `git` must be on your `PATH`.

### Choosing skills

shelf looks for `SKILL.md` files in the source (or under `--path`), up to four levels deep, skipping `.git` and `node_modules`. When it finds more than one, choose:

```console
$ shelf add ./upstream
error: The source holds 2 skills: changelog, commit-messages
hint: Choose with --skill <name> (comma-separated) or take all with --all
```

`--skill a,b` takes the named ones; `--all` takes every one. Every skill is checked before anything is imported, so a batch is never half-applied.

## The audit

Every `add`, `pull` and `adopt` runs a local, offline audit over every file of the skill, and `shelf audit` runs it over your library. It is a tripwire for review, not a sandbox.

| Rule | Severity | Flags |
|---|---|---|
| `pipe-to-shell` | high | Downloading and executing a script (`curl … \| sh`, `iwr … \| iex`, `Invoke-Expression`). |
| `decode-and-run` | high | Decoding data and executing it (`base64 -d … \| sh`, `eval(atob(…))`). |
| `prompt-injection` | high | Phrasing that tries to override the agent's other instructions ("ignore previous instructions"). |
| `upload-files` | high | `curl` uploading local files (`-d @file`, `-F`, `-T`). |
| `hidden-characters` | high | Zero-width, text-direction and Unicode tag characters, invisible to a reviewer. |
| `binary-file` | high | Binaries and native executables (`.exe`, `.dll`, `.so`, `.dylib`, `.bin`, `.app`, `.msi`, or any file with NUL bytes). |
| `conceal-from-user` | medium | Asking the agent not to tell the user something. |
| `credential-access` | medium | Reading `~/.ssh`, `~/.aws`, `~/.gnupg`, `~/.kube`, Docker config, private keys, `.env` files or the macOS keychain. |
| `raw-ip-url` | medium | URLs that contact a raw IP address. |
| `encoded-blob` | medium | Long base64-like blobs (200+ characters). |
| `destructive-command` | medium | `rm -rf /`, `rm -rf ~`, `mkfs`, `dd of=/dev/…`. |
| `script-file` | low | Script files (`.sh`, `.py`, `.js`, `.ps1`, …) or executable files the agent may be told to run. |

**High-severity findings block** `add --yes` and `pull --yes`:

```console
$ shelf add ./upstream --skill changelog --yes
changelog (1 file): blocked by high-severity findings. Review them; --yes --force imports anyway
  HIGH   SKILL.md:6  Downloads and executes a script
         Run: curl -fsSL https://example.com/install.sh | sh
```

Read the finding. If it is fine, import anyway with `--yes --force`. Medium and low findings are shown but never block. `shelf adopt` shows findings for review and is never blocked.

Audit your whole library, your own skills included:

```console
$ shelf audit
changelog
  HIGH   SKILL.md:6  Downloads and executes a script
         Run: curl -fsSL https://example.com/install.sh | sh
```

`shelf audit` prints `No findings in N skill(s).` when everything is clean. It always exits 0; check `data.skills[].findings` with `--json` to act on findings in scripts.

## Pull upstream updates

```console
$ shelf pull release-notes
release-notes: changes available — nothing applied. Re-run with --yes to apply
--- a/SKILL.md
+++ b/SKILL.md
@@ -3,4 +3,5 @@
 description: Draft release notes from merged pull requests, grouped by user impact. Use when preparing a release.
 ---
 
 - Group by user impact
+- Link each item to its pull request
Audit:
  no findings

$ shelf pull release-notes --yes
release-notes updated to 3547e8b373. Run `shelf propagate release-notes` to update borrowers
```

`pull` re-fetches the recorded source (the same URL, ref and path), shows the diff against the library's latest revision and a fresh audit, and applies it only with `--yes`. Then run `shelf propagate <name>` to update borrowing projects.

It refuses to clobber your own work: if the library copy was edited since the last import, `pull` fails with `CONFLICT` unless you add `--force`. When the source matches the library, it prints `<name> is up to date with <source>`.

Only skills imported with `shelf add` (or linked to a source) can be pulled.

## Link a skill you already have

Skills you [adopted](migrating.md) from your projects often came from a public repository. Link them to it so you can pull its updates:

```console
$ shelf add gh:someone/skills --skill brand-voice
brand-voice (1 file): already in the library and identical to the source. Re-run with --yes to link them, so `shelf pull` fetches updates
  no findings

$ shelf add gh:someone/skills --skill brand-voice --yes
brand-voice (1 file): linked to this source (library unchanged). `shelf pull` now fetches its updates
  no findings
```

When the library already has a skill with the same name, `add --yes` records the source without changing the library. If the source differs, the review says in how many files. The library's current revision counts as the last import, so the next `shelf pull` offers the upstream version as a reviewed update.

A skill can be linked to one source. Adding again fails with `SKILL_EXISTS`; use `shelf pull`. So does adding a skill with an archived skill's name: restore the archived skill by moving it back from `~/.shelf/archive/` (`add --yes` then links it), or restore it and `shelf rename` it to free the name.

## What agents may do

Agents (any actor starting with `agent:`) may run the review step of `add` and `pull`, and may link existing skills. They may not change library content from a git source, meaning `add --yes` of a new skill or `pull --yes`, unless you set `allowAgentImports` to `true` in the [config](configuration.md):

```console
$ shelf add gh:someone/skills --skill seo-checklist --yes
error: Agents may review skills from remote sources but not import them
hint: Show the user the review and ask them to run the command with --yes themselves, or to set allowAgentImports in ~/.shelf/config.json
```

The agent shows you the review and the exact command, and you run it. Imports from a local directory are not restricted. The guide also tells agents never to pass `--force` on high-severity findings without your explicit approval.

This rule depends on shelf knowing an agent is acting. Agents are detected from their environment (see [Environment](environment.md)), and `--actor` can override that, so treat it as a guard rail for well-behaved agents, not as a security boundary against a hostile one.

## Related

- [Migrating](migrating.md)
- [`shelf add`](cli/add.md), [`shelf pull`](cli/pull.md), [`shelf audit`](cli/audit.md)
