/**
 * Every failure that a caller (human or agent) can act on is a ShelfError with a
 * stable `code`. The CLI maps codes to exit codes and puts `hint` — ideally an
 * exact command that resolves the problem — into its JSON envelope.
 */
export type ErrorCode =
  | "INVALID_ARGUMENT"
  | "INVALID_SKILL"
  | "NOT_INITIALIZED"
  | "SKILL_NOT_FOUND"
  | "SKILL_EXISTS"
  | "NOT_BORROWED"
  | "CONFLICT"
  | "LOCAL_CHANGES"
  | "LOAN_LIMIT";

export class ShelfError extends Error {
  override readonly name = "ShelfError";

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly hint?: string,
  ) {
    super(message);
  }
}
