"use client";

import { useLayoutEffect, type ReactNode } from "react";

import {
  saveCheckoutCartSnapshot,
} from "@/lib/checkout-cart-snapshot";
import {
  resolveCartLinesForCheckout,
  useCartStore,
} from "@/store/cart-store";

/** Verrouille le panier dès l'entrée sur le checkout (avant CheckoutView). */
export default function CheckoutLayout({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const snapshot = resolveCartLinesForCheckout();
    if (snapshot.length > 0) {
      saveCheckoutCartSnapshot(snapshot);
      if (useCartStore.getState().lines.length === 0) {
        useCartStore.setState({ lines: snapshot });
      }
    }
    useCartStore.getState().lockForCheckout();

    return () => {
      useCartStore.getState().unlockCheckout();
    };
  }, []);

  return children;
}
