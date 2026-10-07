#!/usr/bin/env bun
import { runCommand, runMain } from "citty";
import { main } from "./cli.ts";
import { printUsageError } from "./output.ts";

const rawArgs = process.argv.slice(2);
if (rawArgs.includes("--json") && !rawArgs.some((arg) => arg === "--help" || arg === "-h")) {
  // Agents asked for JSON, so usage errors (unknown command, missing argument)
  // must arrive as an envelope too rather than as help text.
  runCommand(main, { rawArgs }).catch((error: unknown) => {
    process.exitCode = printUsageError(error);
  });
} else {
  void runMain(main);
}
