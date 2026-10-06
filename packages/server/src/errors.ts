import { type ErrorCode, ShelfError } from "@shelf/core";
import type { Context as HonoContext } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** The body of every failed API response. `code` matches the CLI's error codes. */
export interface ApiErrorBody {
  readonly error: {
    readonly code: ErrorCode | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "INTERNAL";
    readonly message: string;
    readonly hint: string | null;
  };
}

const STATUS: Record<ErrorCode, ContentfulStatusCode> = {
  INVALID_ARGUMENT: 400,
  INVALID_SKILL: 400,
  NOT_INITIALIZED: 404,
  SKILL_NOT_FOUND: 404,
  NOT_BORROWED: 404,
  SKILL_EXISTS: 409,
  CONFLICT: 409,
  LOCAL_CHANGES: 409,
  LOAN_LIMIT: 422,
  NOT_ALLOWED: 403,
};

export function errorBody(
  code: ApiErrorBody["error"]["code"],
  message: string,
  hint?: string | null,
): ApiErrorBody {
  return { error: { code, message, hint: hint ?? null } };
}

/** Maps any thrown error to the error envelope; unexpected errors become 500s. */
export function handleError(error: unknown, c: HonoContext) {
  if (error instanceof ShelfError) {
    return c.json(errorBody(error.code, error.message, error.hint), STATUS[error.code]);
  }
  console.error(error);
  return c.json(errorBody("INTERNAL", error instanceof Error ? error.message : String(error)), 500);
}
