import type { Api, ApiErrorBody } from "@shelf/server/contract";
import { TOKEN_HEADER } from "@shelf/server/contract";
import { type ClientResponse, hc } from "hono/client";
import { readToken } from "./token.ts";

const token = readToken();

/**
 * Typed client generated from the server's route definitions: a changed route or
 * response shape on the server is a compile error here.
 */
export const api = hc<Api>(location.origin, { headers: { [TOKEN_HEADER]: token } }).api;

/** A failed API call, carrying the same error codes and hints as the CLI. */
export class ApiError extends Error {
  readonly code: string;
  readonly hint: string | null;
  readonly status: number;

  constructor(status: number, body: Partial<ApiErrorBody> | null) {
    super(body?.error?.message ?? `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.code = body?.error?.code ?? "INTERNAL";
    this.hint = body?.error?.hint ?? null;
  }
}

/** The body type of a response's successful (2xx) variants. */
type Success<R> =
  R extends ClientResponse<infer Body, infer Status, "json">
    ? Status extends 200 | 201
      ? Body
      : never
    : never;

/** Awaits a client call and returns its JSON body, throwing `ApiError` on failure. */
export async function unwrap<R extends ClientResponse<unknown, number, "json">>(
  request: Promise<R>,
): Promise<Success<R>> {
  const response = await request;
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) throw new ApiError(response.status, body as Partial<ApiErrorBody> | null);
  return body as Success<R>;
}
