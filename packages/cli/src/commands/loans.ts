import {
  borrow,
  detach,
  parseDays,
  promote,
  propagate,
  renew,
  returnSkill,
  setDue,
  shortHash,
  update,
} from "@shelf/core";
import { positionals, shelfCommand } from "../command.ts";
import { formatDate, lines } from "../format.ts";
import { renderPropagation } from "./library.ts";

const reasonArg = {
  type: "string",
  description: "Why, recorded in the activity log",
} as const;

const forceArg = (description: string) => ({ type: "boolean", description }) as const;

export const borrowCommand = shelfCommand({
  name: "borrow",
  description: "Copy library skills into this project with a due date",
  args: {
    skill: { type: "positional", required: true, description: "One or more skill names" },
    days: { type: "string", description: "Loan length in days (default: config loanDays)" },
    follow: {
      type: "boolean",
      description: "Let `shelf sync` apply library updates automatically",
    },
    link: {
      type: "boolean",
      description: "One copy per project; other harness directories symlink to it",
    },
  },
  async run(ctx, args) {
    const results = await borrow(ctx, positionals(args), {
      days: parseDays(args.days, ctx.config.loanDays),
      policy: args.follow ? "follow" : "pinned",
      ...(args.link ? { mode: "link" as const } : {}),
    });
    return {
      data: { skills: results },
      text: lines(
        ...results.map((result) =>
          result.status === "borrowed"
            ? `Borrowed ${result.skill} until ${formatDate(result.dueAt)} → ${result.targets.join(", ")}`
            : `${result.skill} is already borrowed (due ${formatDate(result.dueAt)})`,
        ),
      ),
    };
  },
});

export const renewCommand = shelfCommand({
  name: "renew",
  description: "Extend a loan (from its due date, or from today if overdue)",
  args: {
    skill: { type: "positional", required: true, description: "Skill name" },
    days: { type: "string", description: "Days to extend by (default: config loanDays)" },
    reason: reasonArg,
  },
  async run(ctx, args) {
    const change = await renew(ctx, args.skill, {
      days: parseDays(args.days, ctx.config.loanDays),
      ...(args.reason ? { reason: args.reason } : {}),
    });
    return { data: change, text: `${change.skill} is now due ${formatDate(change.dueAt)}` };
  },
});

export const dueCommand = shelfCommand({
  name: "due",
  description: "Move a loan's due date: +14d, -7d, +2w or 2026-12-01",
  args: {
    skill: { type: "positional", required: true, description: "Skill name" },
    when: { type: "positional", required: true, description: "Shift or absolute date" },
    reason: reasonArg,
  },
  async run(ctx, args) {
    const change = await setDue(
      ctx,
      args.skill,
      args.when,
      args.reason ? { reason: args.reason } : {},
    );
    return { data: change, text: `${change.skill} is now due ${formatDate(change.dueAt)}` };
  },
});

export const returnCommand = shelfCommand({
  name: "return",
  description: "Remove a borrowed skill from this project",
  args: {
    skill: { type: "positional", required: true, description: "Skill name" },
    force: forceArg("Discard local edits to the project copy"),
  },
  async run(ctx, args) {
    const result = await returnSkill(ctx, args.skill, { force: Boolean(args.force) });
    return { data: result, text: `Returned ${result.skill}` };
  },
});

export const updateCommand = shelfCommand({
  name: "update",
  description: "Update borrowed skills to the library's latest revision (all if none named)",
  args: {
    skill: { type: "positional", required: false, description: "Skill names (default: all)" },
    force: forceArg("Discard local edits to the project copies"),
  },
  async run(ctx, args) {
    const results = await update(ctx, positionals(args), { force: Boolean(args.force) });
    const describe = {
      updated: "updated to",
      current: "already at",
      "skipped-local-changes": "skipped (local edits) at",
    } as const;
    return {
      data: { skills: results },
      text:
        results.length === 0
          ? "Nothing borrowed."
          : lines(
              ...results.map(
                (result) =>
                  `${result.skill}: ${describe[result.status]} ${shortHash(result.revision)}`,
              ),
            ),
    };
  },
});

export const promoteCommand = shelfCommand({
  name: "promote",
  description: "Publish this project's edits to a skill back to the library",
  args: {
    skill: { type: "positional", required: true, description: "Skill name" },
    force: forceArg("Replace the library revision even if it changed since borrowing"),
    propagate: {
      type: "boolean",
      description: "Then update every other project borrowing it (skips local edits)",
    },
  },
  async run(ctx, args) {
    const result = await promote(ctx, args.skill, { force: Boolean(args.force) });
    const propagation = args.propagate ? await propagate(ctx, args.skill) : null;
    return {
      data: { ...result, propagation },
      text: lines(
        `Promoted ${result.skill}: library ${shortHash(result.previousRevision)} → ${shortHash(result.revision)}`,
        propagation && renderPropagation(propagation),
      ),
    };
  },
});

export const detachCommand = shelfCommand({
  name: "detach",
  description: "Stop managing a skill; its files stay in the project",
  args: { skill: { type: "positional", required: true, description: "Skill name" } },
  async run(ctx, args) {
    const result = await detach(ctx, args.skill);
    return { data: result, text: `Detached ${result.skill}; its files now belong to the project` };
  },
});
