#!/usr/bin/env bun
import { type CommandDef, runCommand, runMain, showUsage } from "citty";
import { main } from "./cli.ts";
import { isUsageError, printUsageError } from "./output.ts";

const NEGATIVE_SHIFT = /^-\d+[dw]$/;

const rawArgs = negativeShiftsAsPositionals(process.argv.slice(2));
const builtin =
  rawArgs.some((arg) => arg === "--help" || arg === "-h") ||
  (rawArgs.length === 1 && (rawArgs[0] === "--version" || rawArgs[0] === "-v"));
if (builtin) {
  void runMain(main, { rawArgs });
} else {
  // Not runMain: it exits 1 on usage errors (unknown command, missing argument),
  // which are INVALID_ARGUMENT (exit 2) like any other bad argument. With --json
  // they arrive as an envelope rather than as help text.
  runCommand(main, { rawArgs }).catch(async (error: unknown) => {
    const json = rawArgs.includes("--json");
    if (!json && isUsageError(error)) await showUsage(...commandAt(rawArgs));
    process.exitCode = printUsageError(error, json);
  });
}

/**
 * `due` takes negative shifts (`-7d`) as its WHEN argument, but citty reads
 * anything starting with `-` as an option. A skill name can't start with `-`,
 * so such a value can only be WHEN: move it after `--`, where it is positional.
 */
function negativeShiftsAsPositionals(args: string[]): string[] {
  const command = args.findIndex((arg) => !arg.startsWith("-"));
  if (args[command] !== "due") return args;
  const end = args.includes("--") ? args.indexOf("--") : args.length;
  const options = args.slice(0, end);
  const shifts = options.filter((arg, index) => index > command && NEGATIVE_SHIFT.test(arg));
  if (shifts.length === 0) return args;
  const rest = args.slice(end + 1);
  return [...options.filter((arg) => !shifts.includes(arg)), "--", ...rest, ...shifts];
}

/** The (sub)command the arguments name, and its parent, for printing its usage. */
function commandAt(args: string[]): [CommandDef, CommandDef | undefined] {
  let command: CommandDef = main;
  let parent: CommandDef | undefined;
  for (const arg of args) {
    if (arg === "--") break;
    if (arg.startsWith("-")) continue;
    const sub = (command.subCommands as Record<string, CommandDef> | undefined)?.[arg];
    if (!sub) break;
    [parent, command] = [command, sub];
  }
  return [command, parent];
}
