"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { CartLine, FlocageOption } from "@/types/domain";

import { loadCheckoutCartSnapshot } from "@/lib/checkout-cart-snapshot";

interface CartState {
  lines: CartLine[];
  checkoutLocked: boolean;
  checkoutLockCount: number;
  addLine: (line: CartLine) => void;
  removeLine: (productId: string, variantId: string | null) => void;
  setQuantity: (
    productId: string,
    variantId: string | null,
    quantity: number,
  ) => void;
  setFlocage: (
    productId: string,
    variantId: string | null,
    flocage: FlocageOption | undefined,
  ) => void;
  lockForCheckout: () => void;
  unlockCheckout: () => void;
  clear: () => void;
}

function sameLine(a: CartLine, productId: string, variantId: string | null) {
  return a.productId === productId && a.variantId === variantId;
}

function lineTotal(line: CartLine): number {
  const flocageUnit = line.flocage?.enabled ? line.flocage.price : 0;
  return (line.unitPrice + flocageUnit) * line.quantity;
}

function isMutationsBlocked(get: () => CartState): boolean {
  return get().checkoutLocked;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      checkoutLocked: false,
      checkoutLockCount: 0,
      addLine: (line) => {
        if (isMutationsBlocked(get)) return;
        set((state) => {
          const existing = state.lines.find((l) =>
            sameLine(l, line.productId, line.variantId),
          );
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                sameLine(l, line.productId, line.variantId)
                  ? {
                      ...l,
                      quantity: l.quantity + line.quantity,
                      flocage: line.flocage ?? l.flocage,
                    }
                  : l,
              ),
            };
          }
          return { lines: [...state.lines, line] };
        });
      },
      removeLine: (productId, variantId) => {
        if (isMutationsBlocked(get)) return;
        set((state) => ({
          lines: state.lines.filter((l) => !sameLine(l, productId, variantId)),
        }));
      },
      setQuantity: (productId, variantId, quantity) => {
        if (isMutationsBlocked(get)) return;
        set((state) => ({
          lines: state.lines
            .map((l) =>
              sameLine(l, productId, variantId)
                ? { ...l, quantity: Math.max(1, quantity) }
                : l,
            )
            .filter((l) => l.quantity > 0),
        }));
      },
      setFlocage: (productId, variantId, flocage) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            sameLine(l, productId, variantId) ? { ...l, flocage } : l,
          ),
        })),
      lockForCheckout: () =>
        set((state) => ({
          checkoutLockCount: state.checkoutLockCount + 1,
          checkoutLocked: true,
        })),
      unlockCheckout: () =>
        set((state) => {
          const next = Math.max(0, state.checkoutLockCount - 1);
          return {
            checkoutLockCount: next,
            checkoutLocked: next > 0,
          };
        }),
      clear: () => {
        if (isMutationsBlocked(get)) return;
        set({ lines: [] });
      },
    }),
    {
      name: "maillot-cart",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ lines: state.lines }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<CartState> | undefined;
        const savedLines = Array.isArray(saved?.lines) ? saved.lines : [];
        const currentLines = Array.isArray(current.lines) ? current.lines : [];
        return {
          ...current,
          lines: savedLines.length > 0 ? savedLines : currentLines,
        };
      },
    },
  ),
);

/** Derived selectors. */
export const cartSelectors = {
  lines: (state: CartState) => state.lines,
  count: (state: CartState) =>
    state.lines.reduce((sum, l) => sum + l.quantity, 0),
  subtotal: (state: CartState) =>
    state.lines.reduce((sum, l) => sum + lineTotal(l), 0),
  lineTotal,
};

/** Lecture directe localStorage (secours si le store est vide à tort). */
export function readPersistedCartLines(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("maillot-cart");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { state?: { lines?: CartLine[] } };
    return Array.isArray(parsed.state?.lines) ? parsed.state.lines : [];
  } catch {
    return [];
  }
}

export function resolveCartLinesForCheckout(): CartLine[] {
  const storeLines = useCartStore.getState().lines;
  if (storeLines.length > 0) return storeLines.map((l) => ({ ...l }));
  const snapshot = loadCheckoutCartSnapshot();
  if (snapshot.length > 0) return snapshot.map((l) => ({ ...l }));
  return readPersistedCartLines().map((l) => ({ ...l }));
}
