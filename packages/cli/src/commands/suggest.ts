import { parsePositiveInt, suggestHere } from "@shelf/core";
import { shelfCommand } from "../command.ts";
import { lines, table, truncate } from "../format.ts";

export const suggestCommand = shelfCommand({
  name: "suggest",
  description: "Suggest library skills that match what this project uses (its dependencies, files)",
  args: {
    limit: { type: "string", description: "Most suggestions to show (default: 8)" },
  },
  async run(ctx, args) {
    const result = await suggestHere(ctx, { limit: parsePositiveInt(args.limit, 8, "--limit") });
    const { suggestions } = result;
    return {
      data: result,
      text:
        suggestions.length === 0
          ? "No suggestions: nothing in this project matches a library skill."
          : lines(
              table([
                ["SKILL", "WHY", "SESSION COST"],
                ...suggestions.map((s) => [
                  s.skill,
                  truncate(s.reasons.join("; "), 60),
                  `~${s.descriptionTokens} tok`,
                ]),
              ]),
              "",
              "Borrow one with `shelf borrow <skill>`.",
            ),
    };
  },
});
