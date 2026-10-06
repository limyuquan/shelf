import { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "../api/client.ts";

/** Data is local and cheap to fetch: refetch on focus, keep retries low. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5_000, retry: 1, refetchOnWindowFocus: true },
    mutations: {
      onError: (error) => {
        toast.error(error.message, {
          ...(error instanceof ApiError && error.hint ? { description: error.hint } : {}),
        });
      },
    },
  },
});
