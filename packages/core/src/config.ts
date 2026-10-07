import { readFile } from "node:fs/promises";
import { z } from "zod";
import { ShelfError } from "./errors.ts";
import { DEFAULT_TARGETS } from "./projection/harnesses.ts";

/**
 * `~/.shelf/config.json`. Each key carries its description, so the docs' config
 * table and `schema/config.schema.json` are generated from this schema
 * (`bun run docs:gen`) and cannot drift from it.
 */
export const ConfigSchema = z
  .object({
    loanDays: z
      .number()
      .int()
      .positive()
      .default(30)
      .describe("Loan length in days for `borrow`, and the default extension for `renew`."),
    maxLoanDays: z
      .number()
      .int()
      .positive()
      .default(90)
      .describe("Upper bound on how far in the future a due date may be set, in days."),
    dueSoonDays: z
      .number()
      .int()
      .nonnegative()
      .default(7)
      .describe("Loans due within this many days are reported as `due-soon`."),
    allowAgentImports: z
      .boolean()
      .default(false)
      .describe(
        "Lets agents run `shelf add` / `shelf pull` from remote sources. Off by default: the library is the trust boundary, and only the user should widen it.",
      ),
    hooks: z
      .boolean()
      .default(true)
      .describe(
        "Install harness hooks (Claude Code, Codex) that renew loans when a skill is used and report loans needing attention at session start. Set by `shelf setup`.",
      ),
    mode: z
      .enum(["copy", "link"])
      .default("copy")
      .describe("`copy`: a copy per target. `link`: one copy, other targets symlink to it."),
    targets: z
      .array(z.string().min(1))
      .min(1)
      .default([...DEFAULT_TARGETS])
      .describe("Project-relative directories that borrowed skills are written into."),
  })
  .describe("shelf configuration (~/.shelf/config.json). Every key is optional.");

export type Config = z.infer<typeof ConfigSchema>;

export async function loadConfig(file: string): Promise<Config> {
  let raw: unknown = {};
  try {
    raw = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new ShelfError("INVALID_ARGUMENT", `Could not read config ${file}: ${error}`);
    }
  }
  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ShelfError(
      "INVALID_ARGUMENT",
      `Invalid config ${file}: ${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}
