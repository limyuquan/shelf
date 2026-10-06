import { readFile } from "node:fs/promises";
import { z } from "zod";
import { ShelfError } from "./errors.ts";
import { DEFAULT_TARGETS } from "./projection/harnesses.ts";

export const ConfigSchema = z.object({
  /** Loan length for `borrow` and the default extension for `renew`. */
  loanDays: z.number().int().positive().default(30),
  /** Upper bound on how far in the future a due date may be set. */
  maxLoanDays: z.number().int().positive().default(90),
  /** Loans due within this many days are reported as `due-soon`. */
  dueSoonDays: z.number().int().nonnegative().default(7),
  /**
   * Lets agents run `shelf add` / `shelf pull` from remote sources. Off by default:
   * the library is the trust boundary, and only the user should widen it.
   */
  allowAgentImports: z.boolean().default(false),
  /** `copy`: a copy per target. `link`: one copy, other targets symlink to it. */
  mode: z.enum(["copy", "link"]).default("copy"),
  /** Project-relative directories that borrowed skills are written into. */
  targets: z
    .array(z.string().min(1))
    .min(1)
    .default([...DEFAULT_TARGETS]),
});

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
