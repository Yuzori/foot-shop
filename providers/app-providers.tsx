"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";

import { UserPreferencesSync } from "@/components/account/user-preferences-sync";
import { getQueryClient } from "@/lib/query-client";
import { CartHydration } from "@/providers/cart-hydration";

/** Wraps the app with React Query (and any future global providers). */
export function AppProviders({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <CartHydration>
        <UserPreferencesSync />
        {children}
      </CartHydration>
    </QueryClientProvider>
  );
}
