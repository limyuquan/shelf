import { type ErrorCode, ShelfError } from "@shelf/core";

/** Bump only on breaking changes to the JSON envelope or any command's `data` shape. */
export const SCHEMA_VERSION = 1;

export interface CommandOutput {
  /** Serialised as the envelope's `data` with `--json`. Dates become ISO strings. */
  readonly data: unknown;
  /** Human-readable rendering of the same result. */
  readonly text: string;
}

const EXIT_CODES: Record<ErrorCode, number> = {
  INVALID_ARGUMENT: 2,
  INVALID_SKILL: 2,
  NOT_INITIALIZED: 3,
  SKILL_NOT_FOUND: 4,
  NOT_BORROWED: 4,
  SKILL_EXISTS: 5,
  CONFLICT: 5,
  LOCAL_CHANGES: 6,
  LOAN_LIMIT: 7,
};
const INTERNAL_EXIT_CODE = 1;

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
