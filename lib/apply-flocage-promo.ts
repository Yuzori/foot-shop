import { shopConfig } from "@/config/shop";
import type { CreateOrderLine } from "@/services/prestashop";

/** Applique un tarif flocage promo sur les lignes (ex. 0,50 € au lieu de 3,99 €). */
export function applyFlocagePromoPrice(
  lines: CreateOrderLine[],
  promoFlocagePrice: number,
): CreateOrderLine[] {
  const delta = shopConfig.flocagePrice - promoFlocagePrice;
  if (delta <= 0) return lines;

  return lines.map((line) => {
    if (!line.flocage) return line;
    const unitPrice = Math.max(0, Math.round((line.unitPrice - delta) * 100) / 100);
    return {
      ...line,
      unitPrice,
      flocage: {
        ...line.flocage,
        price: promoFlocagePrice,
      },
    };
  });
}

/** Réduction totale liée au tarif flocage promo. */
export function flocagePromoDiscount(
  lines: readonly { flocage?: { price?: number } | null; quantity: number }[],
  promoFlocagePrice: number,
): number {
  const delta = shopConfig.flocagePrice - promoFlocagePrice;
  if (delta <= 0) return 0;

  const qty = lines
    .filter((line) => line.flocage)
    .reduce((sum, line) => sum + line.quantity, 0);

  return Math.round(delta * qty * 100) / 100;
}
