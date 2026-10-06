import { spawn } from "node:child_process";
import { createContext, parsePositiveInt } from "@shelf/core";
import { loadToken, startServer } from "@shelf/server";
import bundledSkill from "@shelf/skill/SKILL.md" with { type: "text" };
import page from "@shelf/web/index.html";
import { defineCommand } from "citty";
import pkg from "../../package.json" with { type: "json" };
import { lines } from "../format.ts";
import { resolveHookCommand } from "../hook-command.ts";
import { printFailure, printSuccess } from "../output.ts";

/** Long-running, so it manages its own context instead of using `shelfCommand`. */
export const uiCommand = defineCommand({
  meta: { name: "ui", description: "Open the local dashboard (projects, loans, library editor)" },
  args: {
    port: { type: "string", description: "Port to listen on (default: a free port)" },
    open: { type: "boolean", default: true, description: "Open a browser (--no-open to skip)" },
    "allow-host": {
      type: "string",
      description:
        "Also accept these hosts, e.g. your Tailscale Serve name (comma-separated; name or name:port)",
    },
    "rotate-token": {
      type: "boolean",
      description: "Replace the access token (signs out every browser)",
    },
    json: { type: "boolean", description: "Print the URL as a JSON envelope" },
  },
  async run({ args }) {
    const json = Boolean(args.json);
    try {
      const ctx = await createContext({ actor: "user:dashboard" });
      const port = args.port === undefined ? 0 : parsePositiveInt(args.port, 0, "--port");
      const allowedHosts = (args["allow-host"] ?? "")
        .split(",")
        .map((host) => host.trim())
        .filter(Boolean);
      const token = await loadToken(ctx.paths.home, { rotate: Boolean(args["rotate-token"]) });
      const dashboard = startServer(ctx, {
        page,
        port,
        token,
        allowedHosts,
        system: { version: pkg.version, bundledSkill, hookCommand: resolveHookCommand() },
      });
      // Proxies such as Tailscale Serve terminate HTTPS in front of the dashboard.
      const remote = allowedHosts.map((host) => `https://${host}/?token=${token}`);
      printSuccess(
        {
          data: { url: dashboard.url, remote },
          text: lines(
            `shelf dashboard: ${dashboard.url}`,
            ...remote.map((url) => `             also: ${url}`),
            "Ctrl-C to stop.",
          ),
        },
        json,
      );
      if (args.open) openBrowser(dashboard.url);
      await new Promise(() => {}); // serve until interrupted
    } catch (error) {
      process.exitCode = printFailure(error, json);
    }
  },
});

/** Best effort: the URL is printed regardless, so failures are ignored. */
function openBrowser(url: string): void {
  const [command, ...args] =
    process.platform === "darwin"
      ? ["open", url]
      : process.env.WSL_DISTRO_NAME
        ? ["cmd.exe", "/c", "start", '""', url]
        : ["xdg-open", url];
  if (!command) return;
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.on("error", () => {});
  child.unref();
}
