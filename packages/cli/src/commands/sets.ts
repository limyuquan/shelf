import { deleteSet, listSets, type SkillSet, saveSet } from "@shelf/core";
import { defineCommand } from "citty";
import { positionals, shelfCommand } from "../command.ts";
import { lines, table, truncate } from "../format.ts";

const describeSet = (set: SkillSet) =>
  `${set.name} (${set.skills.length} skill${set.skills.length === 1 ? "" : "s"}): ${set.skills.join(", ")}`;

const listCommand = shelfCommand({
  name: "list",
  description: "List your skill sets",
  async run(ctx) {
    const sets = await listSets(ctx);
    return {
      data: { sets },
      text:
        sets.length === 0
          ? "No sets yet. Create one with `shelf set save <name> <skill…>`."
          : table([
              ["NAME", "SKILLS", "DESCRIPTION"],
              ...sets.map((set) => [
                set.name,
                truncate(set.skills.join(", "), 60),
                truncate(set.description, 50),
              ]),
            ]),
    };
  },
});

const saveCommand = shelfCommand({
  name: "save",
  description: "Create a set, or replace its skills (accepts @set to extend another set)",
  args: {
    name: { type: "positional", required: true, description: "Set name, e.g. frontend" },
    skill: { type: "positional", required: true, description: "One or more skill names" },
    description: { type: "string", alias: "d", description: "What the set is for" },
  },
  async run(ctx, args) {
    const set = await saveSet(ctx, args.name, {
      skills: positionals(args).slice(1),
      ...(args.description === undefined ? {} : { description: args.description }),
    });
    return {
      data: { set },
      text: lines(`Saved ${describeSet(set)}`, `Borrow it with \`shelf borrow @${set.name}\``),
    };
  },
});

const deleteCommand = shelfCommand({
  name: "delete",
  description: "Delete a set (borrowed skills and loans are unaffected)",
  args: { name: { type: "positional", required: true, description: "Set name" } },
  async run(ctx, args) {
    const set = await deleteSet(ctx, args.name);
    return { data: { set }, text: `Deleted the set ${set.name}` };
  },
});

/** Named groups of library skills, borrowed together with `shelf borrow @<set>`. */
export const setCommand = defineCommand({
  meta: {
    name: "set",
    description: "Group library skills into sets, borrowed together with `shelf borrow @<set>`",
  },
  subCommands: { list: listCommand, save: saveCommand, delete: deleteCommand },
});
