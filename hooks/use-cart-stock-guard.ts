"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useCartPersistHydrated } from "@/hooks/use-cart-persist-hydrated";
import { useCartStore } from "@/store/cart-store";
import { useFavoritesStore } from "@/store/favorites-store";

export type CartStockGuardStatus = "idle" | "checking" | "valid" | "invalid";

export interface CartStockGuardState {
  status: CartStockGuardStatus;
  message: string | null;
}

const DEFAULT_STATE: CartStockGuardState = {
  status: "idle",
  message: null,
};

/** Retire du panier et des favoris les articles supprimés ou en rupture (vérif serveur). */
export function useCartStockGuard(options?: { enabled?: boolean }): CartStockGuardState {
  const pathname = usePathname();
  const enabled = options?.enabled ?? true;
  const cartReady = useCartPersistHydrated();
  const lines = useCartStore((s) => s.lines);
  const removeLine = useCartStore((s) => s.removeLine);
  const removeFavorite = useFavoritesStore((s) => s.remove);
  const signature = lines
    .map((l) => `${l.productId}:${l.variantId ?? ""}:${l.quantity}`)
    .join("|");
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const [state, setState] = useState<CartStockGuardState>(DEFAULT_STATE);

  useEffect(() => {
    if (!enabled || !cartReady) {
      setState(DEFAULT_STATE);
      return;
    }

    if (lines.length === 0) {
      setState({ status: "valid", message: null });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setState((current) =>
      current.status === "valid" ? { status: "checking", message: null } : current,
    );

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
        if (cancelled) return;
        if (!res.ok) {
          setState({
            status: "invalid",
            message: "Impossible de vérifier la disponibilité des articles.",
          });
          return;
        }

        const data = (await res.json()) as {
          ok?: boolean;
          invalid?: {
            productId: string;
            variantId: string | null;
            message?: string;
          }[];
          message?: string;
        };
        if (cancelled) return;

        const invalid = data.invalid ?? [];
        if (invalid.length > 0 && !useCartStore.getState().checkoutLocked) {
          const removedProducts = new Set<string>();
          for (const row of invalid) {
            removeLine(row.productId, row.variantId);
            removedProducts.add(row.productId);
          }
          for (const productId of removedProducts) {
            removeFavorite(productId);
          }
        }

        if (cancelled) return;

        if (!data.ok || invalid.length > 0) {
          setState({
            status: "invalid",
            message:
              invalid[0]?.message ??
              data.message ??
              "Certains articles ne sont plus disponibles et ont été retirés.",
          });
          return;
        }

        setState({ status: "valid", message: null });
      } catch {
        if (!cancelled) {
          setState({
            status: "invalid",
            message: "Impossible de vérifier la disponibilité des articles.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, cartReady, signature, removeLine, removeFavorite, lines]);

  return state;
}
