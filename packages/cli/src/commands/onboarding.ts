import { homedir } from "node:os";
import { adopt, parsePositiveInt, scan, shortHash } from "@shelf/core";
import { positionals, shelfCommand } from "../command.ts";
import { lines } from "../format.ts";
import { renderFindings } from "./sources.ts";

export const scanCommand = shelfCommand({
  name: "scan",
  description: "Find skill copies under a directory and group duplicates and drifted versions",
  args: {
    dir: { type: "positional", required: false, description: "Directory to scan (default: .)" },
    depth: { type: "string", description: "How many directory levels to descend (default: 6)" },
  },
  async run(ctx, args) {
    const report = await scan(ctx, args.dir ?? ctx.cwd, {
      maxDepth: parsePositiveInt(args.depth, 6, "--depth"),
    });
    const home = homedir();
    const tilde = (path: string) => (path.startsWith(home) ? `~${path.slice(home.length)}` : path);
    const text =
      report.groups.length === 0
        ? `No skills found under ${report.root}.`
        : lines(
            ...report.groups.flatMap((group) => [
              `${group.name}  ${group.copies} cop${group.copies === 1 ? "y" : "ies"}, ${group.variants.length} version(s)${group.inLibrary ? ", in library" : ""}`,
              ...group.variants.flatMap((variant) => [
                `  ${shortHash(variant.revision)}${variant.isLibraryLatest ? " (library latest)" : variant.inLibraryHistory ? " (old library revision)" : ""}`,
                ...variant.copies.map(
                  (copy) => `    ${tilde(copy.path)}${copy.managed ? "  [managed]" : ""}`,
                ),
              ]),
            ]),
            "",
            "Adopt a copy into the library and manage its project's copies: shelf adopt <path>",
          );
    return { data: report, text };
  },
});

export const adoptCommand = shelfCommand({
  name: "adopt",
  description: "Import existing skill directories into the library and manage them as loans",
  args: {
    path: { type: "positional", required: true, description: "One or more skill directories" },
    unedited: {
      type: "boolean",
      description:
        "The copies have no local edits: treat differing ones as older versions (list the newest first)",
    },
  },
  async run(ctx, args) {
    const results = await adopt(ctx, positionals(args), { unedited: Boolean(args.unedited) });
    const describe = {
      imported: "imported into the library",
      matched: "matches the library",
      older: "an older version of the library's (`shelf update` brings it up to date)",
      differs:
        "differs from the library (kept as local edits; if it is only an older version, `shelf update --force` replaces it)",
    } as const;
    return {
      data: { skills: results },
      text: lines(
        ...results.map((result) =>
          lines(
            `${result.skill}: ${describe[result.library]}`,
            result.loan
              ? `  ${result.loan.status === "created" ? "now borrowed by" : "already borrowed by"} ${result.loan.project} (${result.loan.content})`
              : `  no loan: ${result.note}`,
            ...(result.findings.length > 0 ? renderFindings(result.findings, "  ") : []),
          ),
        ),
      ),
    };
  },
});
