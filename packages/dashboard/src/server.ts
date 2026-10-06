import { randomBytes } from "node:crypto";
import { type Context, type ErrorCode, ShelfError } from "@shelf/core";
import { API_ROUTES, type ApiHandler } from "./api.ts";
import index from "./app/index.html";

export interface Dashboard {
  readonly url: string;
  readonly port: number;
  stop(): Promise<void>;
}

/** Header the frontend sends; the token comes from the URL `shelf ui` prints. */
export const TOKEN_HEADER = "x-shelf-token";

const HTTP_STATUS: Record<ErrorCode, number> = {
  INVALID_ARGUMENT: 400,
  INVALID_SKILL: 400,
  NOT_INITIALIZED: 404,
  SKILL_NOT_FOUND: 404,
  NOT_BORROWED: 404,
  SKILL_EXISTS: 409,
  CONFLICT: 409,
  LOCAL_CHANGES: 409,
  LOAN_LIMIT: 422,
};

/** A long-lived reader can keep the WAL from shrinking; checkpoint periodically. */
const CHECKPOINT_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Serves the dashboard on 127.0.0.1 only. API calls must carry the per-process
 * token and a matching Host header, so neither other local users' browsers nor
 * DNS-rebinding pages can drive it.
 */
export function startDashboard(ctx: Context, options: { port?: number } = {}): Dashboard {
  const token = randomBytes(24).toString("base64url");
  let allowedHosts = new Set<string>();

  const guard =
    (handler: ApiHandler) =>
    async (request: Request & { params?: Record<string, string> }): Promise<Response> => {
      if (!allowedHosts.has(request.headers.get("host") ?? "")) {
        return json(403, failure("FORBIDDEN", "Unexpected Host header"));
      }
      if (request.headers.get(TOKEN_HEADER) !== token) {
        return json(401, failure("UNAUTHORIZED", "Missing or wrong dashboard token"));
      }
      try {
        const body = request.method === "GET" ? {} : await readJsonBody(request);
        const data = await handler(ctx, {
          params: request.params ?? {},
          body,
          url: new URL(request.url),
        });
        return json(200, { schemaVersion: 1, ok: true, data });
      } catch (error) {
        if (error instanceof ShelfError) {
          return json(HTTP_STATUS[error.code], failure(error.code, error.message, error.hint));
        }
        console.error(error);
        return json(
          500,
          failure("INTERNAL", error instanceof Error ? error.message : String(error)),
        );
      }
    };

  const routes = Object.fromEntries(
    Object.entries(API_ROUTES).map(([path, methods]) => [
      path,
      Object.fromEntries(
        Object.entries(methods).map(([method, handler]) => [method, guard(handler)]),
      ),
    ]),
  );

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: options.port ?? 0,
    routes: { "/": index, ...routes },
    fetch: () => new Response("Not found", { status: 404 }),
  });
  const port = server.port as number;
  allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);

  const checkpoint = setInterval(
    () => ctx.db.run("PRAGMA wal_checkpoint(TRUNCATE)"),
    CHECKPOINT_INTERVAL_MS,
  );
  return {
    url: `http://127.0.0.1:${port}/?token=${token}`,
    port,
    async stop() {
      clearInterval(checkpoint);
      await server.stop(true);
    },
  };
}

function json(status: number, body: unknown): Response {
  return Response.json(body, { status });
}

function failure(code: string, message: string, hint?: string) {
  return { schemaVersion: 1, ok: false, error: { code, message, hint: hint ?? null } };
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text) return {};
  try {
    const body: unknown = JSON.parse(text);
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  throw new ShelfError("INVALID_ARGUMENT", "Request body must be a JSON object");
}
