"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";
import type { SortOption } from "@/types/domain";

/** All active categories. */
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories(),
    queryFn: () => api.getCategories(),
    staleTime: 5 * 60 * 1000,
  });
}

/** A category with its first page of products. */
export function useCategory(
  id: string,
  options?: { audience?: "kids" | "adult" | null; sort?: SortOption },
) {
  const audience = options?.audience ?? null;
  const sort = options?.sort;

  return useQuery({
    queryKey: [...queryKeys.category(id), audience ?? "all", sort ?? "relevance"],
    queryFn: () =>
      api.getCategory(id, {
        audience: audience ?? undefined,
        sort,
      }),
    enabled: Boolean(id),
    staleTime: 2 * 60 * 1000,
  });
}
