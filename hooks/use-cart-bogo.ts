"use client";

import { useMemo } from "react";

import {
  allocateBogoFreeQuantities,
  bogoLineFromCart,
  calculateWelcomeBogo,
} from "@/lib/welcome-bogo";
import { welcomePromo } from "@/config/promotions";
import { cartSelectors, useCartStore } from "@/store/cart-store";
import type { CartLine } from "@/types/domain";

export function cartLineUnitPrice(line: CartLine): number {
  const flocageUnit = line.flocage?.enabled ? line.flocage.price : 0;
  return line.unitPrice + flocageUnit;
}

/** Estimation BOGO panier (confirmation au paiement selon éligibilité). */
export function useCartBogo() {
  const lines = useCartStore((s) => s.lines);
  const subtotal = useCartStore(cartSelectors.subtotal);

  const bogoLines = useMemo(
    () => lines.map((line) => bogoLineFromCart(line)),
    [lines],
  );

  const totalUnits = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity, 0),
    [lines],
  );

  const eligible = welcomePromo.enabled && totalUnits >= 3;

  const freePerLine = useMemo(() => {
    if (!eligible) return lines.map(() => 0);
    return allocateBogoFreeQuantities(bogoLines);
  }, [eligible, bogoLines, lines]);

  const bogo = useMemo(() => {
    if (!eligible) return null;
    return calculateWelcomeBogo(bogoLines);
  }, [eligible, bogoLines]);

  const total =
    bogo?.applied && bogo.discountTotal > 0
      ? Math.max(0, subtotal - bogo.discountTotal)
      : subtotal;

  return { freePerLine, bogo, eligible, total, subtotal, bogoLines };
}
