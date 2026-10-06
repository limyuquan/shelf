#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import pkg from "../package.json" with { type: "json" };
import { guideCommand } from "./commands/guide.ts";
import { catalogCommand, newCommand, showCommand } from "./commands/library.ts";
import {
  borrowCommand,
  detachCommand,
  dueCommand,
  promoteCommand,
  renewCommand,
  returnCommand,
  updateCommand,
} from "./commands/loans.ts";
import { projectsCommand, statusCommand, syncCommand } from "./commands/project.ts";
import { initCommand, setupCommand } from "./commands/setup.ts";

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
    // Loans in the current project
    borrow: borrowCommand,
    renew: renewCommand,
    due: dueCommand,
    return: returnCommand,
    update: updateCommand,
    promote: promoteCommand,
    detach: detachCommand,
    sync: syncCommand,
    // Across projects
    projects: projectsCommand,
  },
});

void runMain(main);
