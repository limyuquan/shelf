import { spawn } from "node:child_process";
import { createContext, parsePositiveInt } from "@shelf/core";
import { startServer } from "@shelf/server";
import page from "@shelf/web/index.html";
import { defineCommand } from "citty";
import { printFailure, printSuccess } from "../output.ts";

/** Long-running, so it manages its own context instead of using `shelfCommand`. */
export const uiCommand = defineCommand({
  meta: { name: "ui", description: "Open the local dashboard (projects, loans, library editor)" },
  args: {
    port: { type: "string", description: "Port to listen on (default: a free port)" },
    open: { type: "boolean", default: true, description: "Open a browser (--no-open to skip)" },
    json: { type: "boolean", description: "Print the URL as a JSON envelope" },
  },
  async run({ args }) {
    const json = Boolean(args.json);
    try {
      const ctx = await createContext({ actor: "user:dashboard" });
      const port = args.port === undefined ? 0 : parsePositiveInt(args.port, 0, "--port");
      const dashboard = startServer(ctx, { page, port });
      printSuccess(
        {
          data: { url: dashboard.url },
          text: `shelf dashboard: ${dashboard.url}\nCtrl-C to stop.`,
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
