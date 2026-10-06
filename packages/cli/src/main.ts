#!/usr/bin/env bun
import { defineCommand, runCommand, runMain } from "citty";
import pkg from "../package.json" with { type: "json" };
import { guideCommand } from "./commands/guide.ts";
import { hookCommand, usedCommand } from "./commands/hooks.ts";
import {
  catalogCommand,
  diffCommand,
  loanDaysCommand,
  logCommand,
  newCommand,
  propagateCommand,
  restoreCommand,
  showCommand,
} from "./commands/library.ts";
import {
  borrowCommand,
  detachCommand,
  dueCommand,
  keepCommand,
  promoteCommand,
  renewCommand,
  returnCommand,
  updateCommand,
} from "./commands/loans.ts";
import { doctorCommand, sweepCommand } from "./commands/maintenance.ts";
import { adoptCommand, scanCommand } from "./commands/onboarding.ts";
import { projectsCommand, statusCommand, syncCommand } from "./commands/project.ts";
import { initCommand, setupCommand } from "./commands/setup.ts";
import { addCommand, auditCommand, pullCommand } from "./commands/sources.ts";
import { suggestCommand } from "./commands/suggest.ts";
import { targetsCommand } from "./commands/targets.ts";
import { uiCommand } from "./commands/ui.ts";
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
    restore: restoreCommand,
    "loan-days": loanDaysCommand,
    // Loans in the current project
    suggest: suggestCommand,
    borrow: borrowCommand,
    renew: renewCommand,
    used: usedCommand,
    due: dueCommand,
    keep: keepCommand,
    return: returnCommand,
    update: updateCommand,
    promote: promoteCommand,
    detach: detachCommand,
    sync: syncCommand,
    targets: targetsCommand,
    // Bringing skills in: existing copies, or from outside
    scan: scanCommand,
    adopt: adoptCommand,
    add: addCommand,
    pull: pullCommand,
    audit: auditCommand,
    // Across projects
    projects: projectsCommand,
    sweep: sweepCommand,
    doctor: doctorCommand,
    ui: uiCommand,
    // Called by harness hooks, not people
    hook: hookCommand,
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
