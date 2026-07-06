"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { useCartPersistHydrated } from "@/hooks/use-cart-persist-hydrated";
import { useCartStore } from "@/store/cart-store";

/** Retire du panier les articles supprimés ou en rupture (vérif serveur). */
export function useCartStockGuard(options?: { enabled?: boolean }) {
  const pathname = usePathname();
  const onCheckout = pathname.startsWith("/paiement");
  const enabled = (options?.enabled ?? true) && !onCheckout;
  const cartReady = useCartPersistHydrated();
  const lines = useCartStore((s) => s.lines);
  const removeLine = useCartStore((s) => s.removeLine);
  const signature = lines
    .map((l) => `${l.productId}:${l.variantId ?? ""}:${l.quantity}`)
    .join("|");
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (!enabled || !cartReady || lines.length === 0) return;

    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        const res = await fetch("/api/cart/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            lines: lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId,
              name: l.name,
              quantity: l.quantity,
            })),
          }),
        });
        if (cancelled || pathnameRef.current.startsWith("/paiement")) return;
        if (!res.ok) return;
        const data = (await res.json()) as {
          invalid?: { productId: string; variantId: string | null }[];
        };
        if (cancelled || pathnameRef.current.startsWith("/paiement")) return;
        if (useCartStore.getState().checkoutLocked) return;
        for (const row of data.invalid ?? []) {
          removeLine(row.productId, row.variantId);
        }
      } catch {
        // annulation ou erreur réseau — ne pas modifier le panier
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, cartReady, signature, removeLine]);
}
