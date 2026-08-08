"use client";

import {
  CHECKOUT_PROFILE_STORAGE_KEY,
  emptyCheckoutProfile,
} from "@/lib/checkout-profile";
import { useCartStore } from "@/store/cart-store";
import { useFavoritesStore } from "@/store/favorites-store";

/** Vide panier, favoris et profil checkout locaux (déconnexion / changement de compte). */
export function clearAccountLocalState(): void {
  useCartStore.setState({
    lines: [],
    checkoutLocked: false,
    checkoutLockCount: 0,
  });
  useFavoritesStore.getState().clear();

  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("maillot-cart");
      localStorage.removeItem("maillot-favorites");
      localStorage.setItem(
        CHECKOUT_PROFILE_STORAGE_KEY,
        JSON.stringify(emptyCheckoutProfile()),
      );
    } catch {
      /* quota / private mode */
    }
  }
}
