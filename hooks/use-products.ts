"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";
import type { ProductQuery } from "@/types/domain";

/** Paginated product list driven by a query object. */
export function useProducts(query: ProductQuery = {}) {
  return useQuery({
    queryKey: queryKeys.products(query),
    queryFn: () => api.getProducts(query),
    staleTime: 120_000,
    placeholderData: keepPreviousData,
  });
}

/** A single product by id. */
export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: () => api.getProduct(id),
    enabled: Boolean(id),
    staleTime: 300_000,
  });
}
