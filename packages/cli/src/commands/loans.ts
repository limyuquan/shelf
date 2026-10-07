import {
  borrow,
  detach,
  keep,
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

/** `--days`, when given; otherwise the service uses the skill's loan length. */
const daysOption = (value: string | undefined) =>
  value === undefined ? {} : { days: parseDays(value, 0) };

export const borrowCommand = shelfCommand({
  name: "borrow",
  description: "Copy library skills into this project with a due date",
  args: {
    skill: {
      type: "positional",
      required: true,
      description: "One or more skill names, or @<set> for every skill in a set",
    },
    days: {
      type: "string",
      description: "Loan length in days (default: the skill's loan length, else config loanDays)",
    },
    keep: {
      type: "boolean",
      description:
        "Never expire: for skills covering a direct dependency of the project (kept skills load in every session)",
    },
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
      ...daysOption(args.days),
      policy: args.follow ? "follow" : "pinned",
      ...(args.link ? { mode: "link" as const } : {}),
      ...(args.keep ? { keep: true } : {}),
    });
    const until = (result: (typeof results)[number]) =>
      result.kept ? "kept, never expires" : `due ${formatDate(result.dueAt)}`;
    return {
      data: { skills: results },
      text: lines(
        ...results.map((result) =>
          result.status === "borrowed"
            ? `Borrowed ${result.skill} (${until(result)}) → ${result.targets.join(", ")}`
            : `${result.skill} is already borrowed (${until(result)})`,
        ),
      ),
    };
  },
});

export const renewCommand = shelfCommand({
  name: "renew",
  description: "Renew a loan: due the loan length (or --days) from today, unless already due later",
  args: {
    skill: { type: "positional", required: true, description: "Skill name" },
    days: {
      type: "string",
      description: "Days from today (default: the skill's loan length, else config loanDays)",
    },
    reason: reasonArg,
  },
  async run(ctx, args) {
    const change = await renew(ctx, args.skill, {
      ...daysOption(args.days),
      ...(args.reason ? { reason: args.reason } : {}),
    });
    return { data: change, text: `${change.skill} is now due ${formatDate(change.dueAt)}` };
  },
});

export const keepCommand = shelfCommand({
  name: "keep",
  description: "Keep borrowed skills: they never expire (--off to stop keeping)",
  args: {
    skill: { type: "positional", required: true, description: "One or more skill names" },
    off: { type: "boolean", description: "Stop keeping: the loan comes due again if unused" },
    reason: {
      type: "string",
      description: "Why (recorded in the activity log), e.g. the dependency it covers",
    },
  },
  async run(ctx, args) {
    const results = await keep(ctx, positionals(args), {
      keep: !args.off,
      ...(args.reason ? { reason: args.reason } : {}),
    });
    return {
      data: { skills: results },
      text: lines(
        ...results.map((result) =>
          result.kept
            ? `${result.skill}${result.changed ? " is now" : " was already"} kept; it never expires`
            : result.changed
              ? `Stopped keeping ${result.skill}; due ${formatDate(result.dueAt)} unless used`
              : `${result.skill} was not kept (due ${formatDate(result.dueAt)})`,
        ),
      ),
    };
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
