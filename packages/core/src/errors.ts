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
  | "LOAN_LIMIT"
  | "NOT_ALLOWED";

/**
 * What each code means, in words a caller can act on. It lives next to the codes
 * so the docs' error table (`bun run docs:gen`) is generated from the code and
 * cannot drift; the Record type makes a new code without a meaning a type error.
 */
export const ERROR_MEANINGS: Readonly<Record<ErrorCode, string>> = {
  INVALID_ARGUMENT:
    "A missing or malformed argument, option or config value, or a request that does not apply (for example promoting a copy with no local edits).",
  INVALID_SKILL:
    "A SKILL.md is missing, has no or invalid YAML frontmatter, or breaks a rule of the Agent Skills spec (name, description).",
  NOT_INITIALIZED:
    "The current directory is not in a shelf project. Run `shelf init` in the project root.",
  SKILL_NOT_FOUND: "No skill, set or source entry by that name.",
  SKILL_EXISTS: "A skill or set with that name already exists.",
  NOT_BORROWED: "The skill is in the library, but this project has not borrowed it.",
  CONFLICT:
    "The operation would overwrite or orphan something: files shelf does not manage, a newer library revision, copies edited differently, or loans in other projects.",
  LOCAL_CHANGES:
    "The project copy has local edits that the operation would discard. Promote or detach them first, or pass `--force`.",
  LOAN_LIMIT: "The requested loan length or due date is beyond `maxLoanDays`.",
  NOT_ALLOWED:
    "The actor may not do this, for example an agent importing from a remote source while `allowAgentImports` is off.",
};

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
