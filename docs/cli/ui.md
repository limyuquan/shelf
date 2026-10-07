# shelf ui

Opens the local dashboard: loans that need attention across every project, projects, the library editor, revisions, activity, insights and settings. It serves on 127.0.0.1 until you stop it with Ctrl-C.

<!-- generated:cli ui -->
<!-- /generated -->

## What it does

1. Loads the access token from `~/.shelf/ui-token`, creating it (32 random characters, file mode 0600) if it doesn't exist. `--rotate-token` always makes a new one, signing out every browser.
2. Starts the server on 127.0.0.1, on `--port` or a free port the OS picks.
3. Prints the URL with the token and opens it in a browser (`open` on macOS, `cmd.exe /c start` in WSL, `xdg-open` elsewhere), unless `--no-open`. Opening is best effort; the URL is always printed.
4. Serves until interrupted.

Changes made in the dashboard are recorded as `user:dashboard`. Unlike other commands, `ui` doesn't take `--actor`.

The token survives restarts but a random port doesn't; pass `--port` for a stable bookmark. If the port is in use, `ui` fails rather than sharing it with another server.

See [Dashboard](../dashboard.md) for the pages and the security model.

## Examples

```console
$ shelf ui
shelf dashboard: http://127.0.0.1:4222/?token=<token>
Ctrl-C to stop.
```

```sh
shelf ui --port 4300 --no-open
```

## JSON output

```json
{"schemaVersion":1,"ok":true,"data":{"url":"http://127.0.0.1:4221/?token=<token>"}}
```

The envelope is printed once the server is listening; the process keeps running.

## Errors

| Code | When |
|---|---|
| `INVALID_ARGUMENT` | `--port` isn't a positive integer, or the config is invalid. |
| `INTERNAL` | The server couldn't start, for example because the port is in use (`Failed to start server. Is port 4221 in use?`). |

## Related

- [Dashboard](../dashboard.md), [Files](../files.md)
