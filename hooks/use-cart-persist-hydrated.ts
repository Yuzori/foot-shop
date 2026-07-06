"use client";

import { useLayoutEffect, useState } from "react";

import { isCartPersistHydrated, rehydrateCartStore } from "@/lib/cart-persist";

/** True une fois le panier rechargé depuis localStorage (client uniquement). */
export function useCartPersistHydrated(): boolean {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    if (isCartPersistHydrated()) {
      setReady(true);
      return;
    }
    void rehydrateCartStore().finally(() => setReady(true));
  }, []);

  return ready;
}
