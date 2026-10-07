import { type ErrorCode, ShelfError } from "@shelf/core";

/** Bump only on breaking changes to the JSON envelope or any command's `data` shape. */
export const SCHEMA_VERSION = 1;

export interface CommandOutput {
  /** Serialised as the envelope's `data` with `--json`. Dates become ISO strings. */
  readonly data: unknown;
  /** Human-readable rendering of the same result. */
  readonly text: string;
}

/** Exported for the error table in the docs (scripts/site/generate.ts). */
export const EXIT_CODES: Readonly<Record<ErrorCode, number>> = {
  INVALID_ARGUMENT: 2,
  INVALID_SKILL: 2,
  NOT_INITIALIZED: 3,
  SKILL_NOT_FOUND: 4,
  NOT_BORROWED: 4,
  SKILL_EXISTS: 5,
  CONFLICT: 5,
  LOCAL_CHANGES: 6,
  LOAN_LIMIT: 7,
  NOT_ALLOWED: 8,
};
/** Failures that are not a ShelfError have the code INTERNAL. */
export const INTERNAL_EXIT_CODE = 1;
/** For the error table in the docs, next to the ShelfError meanings (ERROR_MEANINGS in core). */
export const INTERNAL_ERROR_MEANING =
  "Anything that is not a ShelfError: a bug or an unexpected I/O error. The message says what failed.";

export function printSuccess(output: CommandOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ schemaVersion: SCHEMA_VERSION, ok: true, data: output.data }));
  } else if (output.text) {
    console.log(output.text);
  }
}

/** Prints the error and returns the process exit code. */
export function printFailure(error: unknown, json: boolean): number {
  const failure =
    error instanceof ShelfError
      ? { code: error.code, message: error.message, hint: error.hint ?? null }
      : {
          code: "INTERNAL",
          message: error instanceof Error ? error.message : String(error),
          hint: null,
        };

  if (json) {
    console.log(JSON.stringify({ schemaVersion: SCHEMA_VERSION, ok: false, error: failure }));
  } else {
    console.error(`error: ${failure.message}`);
    if (failure.hint) console.error(`hint: ${failure.hint}`);
    if (!(error instanceof ShelfError) && error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  }
  return error instanceof ShelfError ? EXIT_CODES[error.code] : INTERNAL_EXIT_CODE;
}

/** A citty usage error: an unknown command or a missing argument. */
export function isUsageError(error: unknown): error is Error {
  return error instanceof Error && error.name === "CLIError";
}

/**
 * Prints a citty usage error (unknown command, missing argument) as an
 * INVALID_ARGUMENT failure and returns its exit code. Anything else is an
 * internal error.
 */
export function printUsageError(error: unknown, json: boolean): number {
  if (!isUsageError(error)) return printFailure(error, json);
  const message = stripAnsi(error.message);
  if (json) {
    const failure = {
      code: "INVALID_ARGUMENT",
      message,
      hint: "Run `shelf --help` or `shelf <command> --help` for usage",
    };
    console.log(JSON.stringify({ schemaVersion: SCHEMA_VERSION, ok: false, error: failure }));
  } else {
    console.error(message);
  }
  return EXIT_CODES.INVALID_ARGUMENT;
}

function stripAnsi(text: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching ANSI escapes is the point
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}
