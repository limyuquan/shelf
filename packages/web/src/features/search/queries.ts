import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, unwrap } from "../../api/client.ts";

/** Skills whose content matches `q`, best first, each with up to three line snippets. */
export const searchQuery = (q: string, limit?: number) =>
  queryOptions({
    queryKey: ["search", { q, limit: limit ?? null }],
    queryFn: () =>
      unwrap(api.search.$get({ query: { q, ...(limit ? { limit: String(limit) } : {}) } })),
  });

/** `value`, once it has stopped changing for `delay` ms. */
export function useDebouncedValue<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Searches as the user types: waits for a pause, and keeps showing the previous
 * results while the next ones load, so the list never flickers. Below
 * `minLength` characters nothing is fetched or shown.
 */
export function useContentSearch(
  input: string,
  {
    limit,
    minLength = 1,
    enabled = true,
  }: { limit?: number; minLength?: number; enabled?: boolean } = {},
) {
  const q = useDebouncedValue(input.trim());
  const search = useQuery({
    ...searchQuery(q, limit),
    enabled: enabled && q.length >= minLength,
    placeholderData: keepPreviousData,
  });
  // Placeholder data outlives a cleared input; hide it as soon as the input is short.
  const active = enabled && input.trim().length >= minLength;
  return { results: active ? search.data : undefined, isFetching: active && search.isFetching };
}
