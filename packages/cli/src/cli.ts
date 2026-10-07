/**
 * The shelf command tree. Importing this module has no side effects (main.ts
 * runs it), so the docs generator (scripts/site/) can read the definitions.
 */
import { type CommandDef, defineCommand } from "citty";
import pkg from "../package.json" with { type: "json" };
import {
  archiveCommand,
  duplicateCommand,
  lintCommand,
  renameCommand,
} from "./commands/authoring.ts";
import { guideCommand } from "./commands/guide.ts";
import { hookCommand, usedCommand } from "./commands/hooks.ts";
import { insightsCommand } from "./commands/insights.ts";
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
import { searchCommand } from "./commands/search.ts";
import { setCommand } from "./commands/sets.ts";
import { initCommand, setupCommand } from "./commands/setup.ts";
import { addCommand, auditCommand, pullCommand } from "./commands/sources.ts";
import { suggestCommand } from "./commands/suggest.ts";
import { targetsCommand } from "./commands/targets.ts";
import { uiCommand } from "./commands/ui.ts";

/**
 * Top-level commands in `shelf --help` order, grouped by what they are for. The
 * groups also head the command index in the docs (`<!-- generated:cli-index -->`).
 */
export const commandGroups: readonly {
  readonly title: string;
  // biome-ignore lint/suspicious/noExplicitAny: commands have different argument types
  readonly commands: Readonly<Record<string, CommandDef<any>>>;
}[] = [
  {
    title: "Getting started",
    commands: {
      setup: setupCommand,
      init: initCommand,
      status: statusCommand,
      guide: guideCommand,
    },
  },
  {
    title: "Library",
    commands: {
      new: newCommand,
      catalog: catalogCommand,
      search: searchCommand,
      show: showCommand,
      log: logCommand,
      diff: diffCommand,
      propagate: propagateCommand,
      restore: restoreCommand,
      "loan-days": loanDaysCommand,
      set: setCommand,
      rename: renameCommand,
      duplicate: duplicateCommand,
      archive: archiveCommand,
      lint: lintCommand,
    },
  },
  {
    title: "Loans in the current project",
    commands: {
      insights: insightsCommand,
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
    },
  },
  {
    title: "Bringing skills in: existing copies, or from outside",
    commands: {
      scan: scanCommand,
      adopt: adoptCommand,
      add: addCommand,
      pull: pullCommand,
      audit: auditCommand,
    },
  },
  {
    title: "Across projects",
    commands: {
      projects: projectsCommand,
      sweep: sweepCommand,
      doctor: doctorCommand,
      ui: uiCommand,
    },
  },
  {
    title: "Called by harness hooks, not people",
    commands: { hook: hookCommand },
  },
];

export const main = defineCommand({
  meta: {
    name: "shelf",
    version: pkg.version,
    description:
      "A personal skill library for coding agents: borrow skills into projects, with due dates",
  },
  subCommands: Object.assign({}, ...commandGroups.map((group) => group.commands)),
});
