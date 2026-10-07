# Automation

How to run shelf unattended: a daily `shelf sweep` with cron, systemd or launchd, using shelf in CI, and scripting it with `--json`.

## Sweep every project daily

Overdue loans are returned when someone runs `shelf status` or `shelf sync` in the project, or when a session starts there with hooks installed. Projects nobody opens keep their overdue skills until then. `shelf sweep` runs a sync in every registered project, so a daily sweep returns them everywhere:

```console
$ shelf sweep
Synced 3 project(s).
  billing-api: updated pdf-tools
```

It returns overdue loans without local edits, restores missing copies, and updates `--follow` loans in each project whose directory exists. Only projects where something changed get a line. Projects whose directory is gone are listed as ``docs-site: /home/me/code/docs-site is missing (`shelf doctor --fix`)``, and `shelf doctor --fix` forgets them.

The schedulers below run shelf without a terminal, so the activity log records the actor as `unknown`. Set `SHELF_ACTOR` to name it.

### cron

```sh
crontab -e
```

```cron
# Every day at 09:00
0 9 * * * SHELF_ACTOR=cron /home/me/.local/bin/shelf sweep >/dev/null 2>&1
```

Use the absolute path of the binary: cron's `PATH` is minimal. With npm, `which shelf` gives the launcher, which needs `node` on cron's `PATH`; the binary itself is simpler.

### systemd (user timer)

`~/.config/systemd/user/shelf-sweep.service`:

```ini
[Unit]
Description=Return overdue shelf loans in every project

[Service]
Type=oneshot
Environment=SHELF_ACTOR=systemd
ExecStart=%h/.local/bin/shelf sweep
```

`~/.config/systemd/user/shelf-sweep.timer`:

```ini
[Unit]
Description=Daily shelf sweep

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

```sh
systemctl --user daemon-reload
systemctl --user enable --now shelf-sweep.timer
```

`Persistent=true` runs a missed sweep after the machine was off.

### launchd (macOS)

`~/Library/LaunchAgents/com.github.limyuquan.shelf-sweep.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.github.limyuquan.shelf-sweep</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/shelf</string>
    <string>sweep</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>SHELF_ACTOR</key>
    <string>launchd</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>9</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
</dict>
</plist>
```

```sh
launchctl load ~/Library/LaunchAgents/com.github.limyuquan.shelf-sweep.plist
```

## In CI

shelf is a personal tool: the library and loans live on your machine, so CI can't borrow or renew. Two things are useful there.

**Lint skills.** If you keep skills in a repository (for example a shared skills repo you `shelf add` from), lint them in CI with a scratch shelf home:

```sh
export SHELF_HOME="$(mktemp -d)"
mkdir -p "$SHELF_HOME/library"
cp -R skills/* "$SHELF_HOME/library/"
shelf lint                                                                                # exits 1 on lint errors
shelf audit --json | jq -e '[.data.skills[].findings[] | select(.severity == "high")] | length == 0'
```

`shelf lint` also reports skills that fail to load at all (no frontmatter, a missing description, a name that doesn't match the directory) as errors. `shelf audit` always exits 0, so the check above reads its JSON.

**Check the lockfile.** `.agents/shelf.lock.json` is plain JSON with a fixed schema (see [Lockfile](lockfile.md)), so CI can read it, for example to check that every skill it lists is also committed:

```sh
jq -r '.skills | to_entries[] | .key as $n | .value.targets[] | "\(.)/\($n)/SKILL.md"' .agents/shelf.lock.json | xargs ls
```

Never let CI write the lockfile.

## Scripting with --json

Every command except `shelf ui` returns once and prints one JSON line with `--json`, so `jq` works on it directly:

```sh
# Skills due within a week in this project
shelf status --json | jq -r '.data.loans[] | select(.due == "due-soon") | .skill'

# Every project with overdue loans
shelf projects --json | jq -r '.data.projects[] | select(.overdue > 0) | .path'

# Library skills nobody has used
shelf insights --json | jq -r '.data.skills[] | select(.neverUsed) | .name'

# Fail when shelf is unhealthy
shelf doctor --json | jq -e 'all(.data.checks[]; .status == "ok")'
```

Check `.ok` before reading `.data`, and branch on `.error.code` for failures; the exit code tells you only the class of error (see [Errors](errors.md)). Commands never prompt and are safe to retry, and several can run at once: writes are serialised on the database.

A script that runs inside an agent harness inherits its environment, so its actions are recorded as that agent. Pass `--actor` (or set `SHELF_ACTOR`) to name your script instead.

`shelf ui --json` prints the URL envelope and keeps serving; read the first line and leave the process running.

## Related

- [`shelf sweep`](cli/sweep.md), [`shelf doctor`](cli/doctor.md)
- [Agents](agents.md), [Environment](environment.md)
