"use client";

import axios from "axios";
import { useQueries } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";
import { useFavoritesStore } from "@/store/favorites-store";
import type { Product } from "@/types/domain";

/** Charge les favoris depuis l'API et retire les produits supprimés (404). */
export function useFavoriteProducts(options?: { enabled?: boolean }) {
  const ids = useFavoritesStore((s) => s.ids);
  const remove = useFavoritesStore((s) => s.remove);
  const queryEnabled = options?.enabled ?? true;

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.product(id),
      queryFn: async () => {
        try {
          return await api.getProduct(id);
        } catch (err) {
          if (axios.isAxiosError(err) && err.response?.status === 404) {
            remove(id);
            return null;
          }
          throw err;
        }
      },
      staleTime: 60_000,
      retry: (failureCount: number, err: unknown) => {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          return false;
        }
        return failureCount < 1;
      },
      enabled: queryEnabled && ids.length > 0,
    })),
  });

  const isLoading =
    ids.length > 0 && results.some((r) => r.isLoading || r.isFetching);
  const products = results
    .map((r) => r.data)
    .filter((p): p is Product => Boolean(p));

  return { products, isLoading, ids };
}
