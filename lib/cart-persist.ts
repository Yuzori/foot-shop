"use client";

import { useCartStore } from "@/store/cart-store";

/** API persist Zustand — indisponible côté serveur. */
export function getCartPersist() {
  if (typeof window === "undefined") return undefined;
  return useCartStore.persist;
}

export function isCartPersistHydrated(): boolean {
  const persist = getCartPersist();
  return persist?.hasHydrated?.() ?? false;
}

export async function rehydrateCartStore(): Promise<void> {
  const persist = getCartPersist();
  if (!persist) return;
  if (persist.hasHydrated()) return;
  await persist.rehydrate();
}
