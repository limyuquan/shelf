/**
 * The API contract, safe to import from the browser: types and constants only,
 * no runtime dependencies on the server or @shelf/core.
 */
export type { Api } from "./app.ts";
export type { ApiErrorBody } from "./errors.ts";

/** Header carrying the per-process token printed by `shelf ui`. */
export const TOKEN_HEADER = "x-shelf-token";
