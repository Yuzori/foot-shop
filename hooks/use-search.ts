"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

/** Product search. Disabled until the term is at least 2 characters. */
export function useSearch(term: string) {
  const query = term.trim();
  return useQuery({
    queryKey: queryKeys.search(query),
    queryFn: () => api.search(query),
    enabled: query.length >= 2,
  });
}
