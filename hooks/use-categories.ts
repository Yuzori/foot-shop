"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

/** All active categories. */
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories(),
    queryFn: () => api.getCategories(),
    staleTime: 5 * 60 * 1000,
  });
}

/** A category with its first page of products. */
export function useCategory(id: string, audience?: "kids" | "adult" | null) {
  return useQuery({
    queryKey: [...queryKeys.category(id), audience ?? "all"],
    queryFn: () =>
      api.getCategory(id, audience ? { audience } : undefined),
    enabled: Boolean(id),
    staleTime: 2 * 60 * 1000,
  });
}
