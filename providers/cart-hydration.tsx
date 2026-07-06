"use client";

import { useLayoutEffect, type ReactNode } from "react";

import { isCartPersistHydrated, rehydrateCartStore } from "@/lib/cart-persist";

/** Recharge le panier depuis localStorage au premier rendu client. */
export function CartHydration({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    if (!isCartPersistHydrated()) {
      void rehydrateCartStore();
    }
  }, []);

  return children;
}
