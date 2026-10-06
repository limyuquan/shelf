import { useCallback, useEffect, useState } from "preact/hooks";
import type { Json } from "../contract.ts";

const TOKEN_KEY = "shelf-token";

/** Moves the one-time token from the URL into session storage and out of sight. */
function readToken(): string {
  const url = new URL(location.href);
  const fromUrl = url.searchParams.get("token");
  if (fromUrl) {
    sessionStorage.setItem(TOKEN_KEY, fromUrl);
    url.searchParams.delete("token");
    history.replaceState(null, "", url);
  }
  return sessionStorage.getItem(TOKEN_KEY) ?? "";
}

const token = readToken();

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly hint: string | null,
  ) {
    super(message);
  }
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<Json<T>> {
  const response = await fetch(path, {
    method,
    headers: { "content-type": "application/json", "x-shelf-token": token },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const envelope = (await response.json()) as
    | { ok: true; data: Json<T> }
    | { ok: false; error: { code: string; message: string; hint: string | null } };
  if (!envelope.ok) {
    throw new ApiError(envelope.error.code, envelope.error.message, envelope.error.hint);
  }
  return envelope.data;
}

export interface Resource<T> {
  readonly data: Json<T> | null;
  readonly error: ApiError | null;
  reload(): void;
  /** Replace the data without a request, e.g. with a mutation's response. */
  set(data: Json<T>): void;
}

export function useApi<T>(path: string): Resource<T> {
  const [data, setData] = useState<Json<T> | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [version, setVersion] = useState(0);

  // `version` is a dependency only so that `reload()` re-runs the request.
  useEffect(() => {
    let cancelled = false;
    api<T>("GET", path).then(
      (result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      },
      (failure: ApiError) => !cancelled && setError(failure),
    );
    return () => {
      cancelled = true;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((n) => n + 1), []);
  return { data, error, reload, set: setData };
}
