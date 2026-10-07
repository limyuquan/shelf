# Installation

Install shelf from npm or as a standalone binary, run `shelf setup` once, and learn how to upgrade and uninstall it.

shelf is one self-contained binary for macOS, Linux and Windows. It does not need Node, Bun or a network connection to run.

## With npm

```sh
npm install -g @limyuquan/shelf
shelf setup
```

The npm package is a small launcher plus one platform package per OS and CPU, listed as optional dependencies, so npm downloads only the binary for your machine. There are no install scripts. Node 18 or later runs the launcher.

If npm was told to skip optional dependencies (`--no-optional`, `--omit=optional`), the launcher can't find a binary and says so:

```
shelf: no prebuilt binary for linux-x64 (@limyuquan/shelf-linux-x64 is not installed).
Reinstall without --no-optional / --omit=optional, or download a binary from the GitHub release.
```

## Binaries

Download an archive for your platform from the [releases page](https://github.com/limyuquan/shelf/releases):

| Platform | Archive |
|---|---|
| macOS, Apple silicon | `shelf-darwin-arm64.tar.gz` |
| macOS, Intel | `shelf-darwin-x64.tar.gz` |
| Linux, x64 | `shelf-linux-x64.tar.gz` |
| Linux, arm64 | `shelf-linux-arm64.tar.gz` |
| Windows, x64 | `shelf-win32-x64.zip` (contains `shelf.exe`) |

Each release also has a `SHA256SUMS` file. Check your download against it, then put the binary on your `PATH`:

```sh
sha256sum --check --ignore-missing SHA256SUMS   # macOS: shasum -a 256 --check --ignore-missing SHA256SUMS
tar -xzf shelf-linux-x64.tar.gz
mv shelf ~/.local/bin/
shelf --version
```

### macOS quarantine

The binaries are not code-signed yet. macOS quarantines files downloaded with a browser and refuses to run them. Clear the flag once:

```sh
xattr -d com.apple.quarantine shelf
```

Installs through npm, or downloads with `curl`, are not affected.

## From source

shelf is built with [Bun](https://bun.com) (the version is pinned in `package.json`, currently 1.4.2):

```sh
git clone https://github.com/limyuquan/shelf.git
cd shelf
bun install
bun run build        # produces dist/shelf
```

`bun run build:all` cross-compiles every platform into `dist/`. See [Contributing](contributing.md) for the development workflow.

## Set up

Run `shelf setup` once after installing, and again after every upgrade:

```console
$ shelf setup
Shelf home: /home/me/.shelf
Library:    /home/me/.shelf/library
Installed the shelf skill at:
  /home/me/.agents/skills/shelf/SKILL.md
  /home/me/.claude/skills/shelf/SKILL.md

Hooks (renew skills when used, report loans needing attention):
  Claude Code: hooks installed (/home/me/.claude/settings.json)
  Codex: hooks installed (/home/me/.codex/hooks.json)
Codex runs new hooks only after you trust them: open `/hooks` in Codex once.
```

It does three things, all safe to repeat:

1. Creates the shelf home (`~/.shelf`, or `$SHELF_HOME`) with `library/`, `objects/` and a `config.json` holding every default.
2. Installs the bundled `shelf` skill in your user-level skill directories, so agents in every project know shelf exists. It costs about 66 tokens of context per session.
3. Installs [hooks](hooks.md) in Claude Code and Codex, if they are installed, so loans renew when agents use skills.

Codex runs new hooks only after you trust them: open `/hooks` in Codex once. To skip the hooks, run `shelf setup --no-hooks`. See [`shelf setup`](cli/setup.md) for details.

Then check everything with:

```sh
shelf doctor
```

## Upgrading

Install the new version the same way you installed the old one (`npm install -g @limyuquan/shelf`, or replace the binary), then run:

```sh
shelf setup
```

This refreshes the bundled skill and points the hooks at the new binary. The hooks call the binary by its absolute path, so moving or replacing the binary at a different path leaves them pointing at the old one; `shelf doctor` reports this and `shelf doctor --fix` repairs it.

Your library, revisions, loans and config are kept across upgrades. The database migrates itself the first time the new version opens it.

## Uninstalling

1. Remove the hooks while shelf is still installed:

   ```sh
   shelf setup --no-hooks
   ```

   This removes only shelf's entries from `~/.claude/settings.json` and `~/.codex/hooks.json`.

2. In each project, decide what happens to borrowed skills. `shelf detach <name>` keeps the files as ordinary project files; `shelf return <name>` removes them. Then delete `.agents/shelf.lock.json`. `shelf projects` lists every project.

3. Delete the bundled skill: `~/.agents/skills/shelf/` and `~/.claude/skills/shelf/` (and the same folder under any other harness that `shelf setup` listed).

4. Back up your library if you want to keep your skills (`~/.shelf/library` holds plain skill folders), then delete `~/.shelf`.

5. Remove the binary: `npm uninstall -g @limyuquan/shelf`, or delete the file.

See [Files](files.md) for everything shelf writes.
