import {
  QueryClient,
  defaultShouldDehydrateQuery,
  isServer,
} from "@tanstack/react-query";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/** Singleton on the client, fresh instance on the server (per request). */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

/** Centralized, type-safe query keys. */
export const queryKeys = {
  products: (params?: unknown) => ["products", params] as const,
  product: (id: string) => ["product", id] as const,
  categories: () => ["categories"] as const,
  category: (id: string) => ["category", id] as const,
  search: (q: string) => ["search", q] as const,
  order: (params: unknown) => ["order", params] as const,
};
