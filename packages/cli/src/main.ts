#!/usr/bin/env bun
import { defineCommand, runCommand, runMain } from "citty";
import pkg from "../package.json" with { type: "json" };
import { guideCommand } from "./commands/guide.ts";
import {
  catalogCommand,
  diffCommand,
  logCommand,
  newCommand,
  propagateCommand,
  showCommand,
} from "./commands/library.ts";
import {
  borrowCommand,
  detachCommand,
  dueCommand,
  promoteCommand,
  renewCommand,
  returnCommand,
  updateCommand,
} from "./commands/loans.ts";
import { doctorCommand, sweepCommand } from "./commands/maintenance.ts";
import { adoptCommand, scanCommand } from "./commands/onboarding.ts";
import { projectsCommand, statusCommand, syncCommand } from "./commands/project.ts";
import { initCommand, setupCommand } from "./commands/setup.ts";
import { printUsageError } from "./output.ts";

const main = defineCommand({
  meta: {
    name: "shelf",
    version: pkg.version,
    description:
      "A personal skill library for coding agents: borrow skills into projects, with due dates",
  },
  subCommands: {
    // Getting started
    setup: setupCommand,
    init: initCommand,
    status: statusCommand,
    guide: guideCommand,
    // Library
    new: newCommand,
    catalog: catalogCommand,
    show: showCommand,
    log: logCommand,
    diff: diffCommand,
    propagate: propagateCommand,
    // Loans in the current project
    borrow: borrowCommand,
    renew: renewCommand,
    due: dueCommand,
    return: returnCommand,
    update: updateCommand,
    promote: promoteCommand,
    detach: detachCommand,
    sync: syncCommand,
    // Bringing existing skills under management
    scan: scanCommand,
    adopt: adoptCommand,
    // Across projects
    projects: projectsCommand,
    sweep: sweepCommand,
    doctor: doctorCommand,
  },
});

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
