"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";
import { useFavoritesStore } from "@/store/favorites-store";
import type { Product } from "@/types/domain";

/** Charge les favoris en une requête groupée (évite 15 appels parallèles → faux 404). */
export function useFavoriteProducts(options?: { enabled?: boolean }) {
  const ids = useFavoritesStore((s) => s.ids);
  const setIds = useFavoritesStore((s) => s.setIds);
  const queryEnabled = options?.enabled ?? true;
  const idsKey = ids.join(",");

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: queryKeys.favoriteProducts(idsKey),
    queryFn: () => api.getProductsByIds(ids),
    enabled: queryEnabled && ids.length > 0,
    staleTime: 60_000,
    retry: 1,
  });

  const lastPrunedKey = useRef("");

  useEffect(() => {
    const unavailable = data?.unavailable;
    if (!unavailable?.length) return;

    const pruneKey = unavailable.join(",");
    if (pruneKey === lastPrunedKey.current) return;
    lastPrunedKey.current = pruneKey;

    const current = useFavoritesStore.getState().ids;
    const gone = new Set(unavailable);
    const next = current.filter((id) => !gone.has(id));
    if (next.length !== current.length) {
      setIds(next);
    }
  }, [data?.unavailable, setIds]);

  const products: Product[] = data?.items ?? [];

  return {
    products,
    isLoading: ids.length > 0 && (isLoading || isFetching) && !isError,
    ids,
  };
}
