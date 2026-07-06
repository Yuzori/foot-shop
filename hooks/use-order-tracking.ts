"use client";

import { useMutation } from "@tanstack/react-query";

import { api } from "@/lib/api";

/** On-demand order tracking by reference. */
export function useOrderTracking() {
  return useMutation({
    mutationFn: (reference: string) => api.trackOrder(reference),
  });
}
