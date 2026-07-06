"use client";

import { useMemo } from "react";

import {
  shouldApplyWelcomePromo,
  useWelcomePromo,
} from "@/components/checkout/welcome-promo-banner";
import {
  allocateBogoFreeQuantities,
  calculateWelcomeBogo,
} from "@/lib/welcome-bogo";
import { cartSelectors, useCartStore } from "@/store/cart-store";
import type { CartLine } from "@/types/domain";

export function cartLineUnitPrice(line: CartLine): number {
  const flocageUnit = line.flocage?.enabled ? line.flocage.price : 0;
  return line.unitPrice + flocageUnit;
}

/** Prix BOGO pour le panier (offre de bienvenue éligible). */
export function useCartBogo() {
  const lines = useCartStore((s) => s.lines);
  const subtotal = useCartStore(cartSelectors.subtotal);
  const welcomePromoQuery = useWelcomePromo();

  const bogoLines = useMemo(
    () =>
      lines.map((line) => ({
        name: line.name,
        unitPrice: cartLineUnitPrice(line),
        quantity: line.quantity,
      })),
    [lines],
  );

  const eligible = shouldApplyWelcomePromo(welcomePromoQuery.data);

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
