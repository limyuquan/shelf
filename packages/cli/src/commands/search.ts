import { parsePositiveInt, searchLibrary } from "@shelf/core";
import { positionals, shelfCommand } from "../command.ts";
import { table, truncate } from "../format.ts";

export const searchCommand = shelfCommand({
  name: "search",
  description: "Find library skills by what they say: names, descriptions, SKILL.md and references",
  args: {
    terms: {
      type: "positional",
      required: true,
      description: 'Search terms (all must match); quote a phrase: "error envelope"',
    },
    limit: { type: "string", description: "Most skills to list (default 10)" },
  },
  async run(ctx, args) {
    // The shell strips quotes; an argument with spaces was a quoted phrase.
    const query = positionals(args)
      .map((term) => (/\s/.test(term) ? `"${term}"` : term))
      .join(" ");
    const results = await searchLibrary(ctx, query, {
      limit: parsePositiveInt(args.limit, 10, "--limit"),
    });
    return {
      data: { query, results },
      text:
        results.length === 0
          ? "No skill mentions that. Try fewer terms, or `shelf catalog` to list every skill."
          : results
              .map((result) => {
                const matches = result.matches.map((match) => [
                  `  ${match.file}:${match.line}`,
                  match.snippet,
                ]);
                return [
                  `${result.name}  ${truncate(result.description, 70)}`,
                  ...(matches.length > 0 ? [table(matches)] : []),
                ].join("\n");
              })
              .join("\n\n"),
    };
  },
});
