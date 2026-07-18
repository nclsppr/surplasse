import { QueryClient } from "@tanstack/react-query";

/**
 * Shared TanStack Query client defaults. A menu changes rarely during a
 * seating: keep it fresh for a minute, retry once (mobile networks in dining
 * rooms are flaky, more retries would just delay the error state).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 1,
      },
    },
  });
}
