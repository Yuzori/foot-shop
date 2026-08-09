import "server-only";



import { resolveCartLines } from "@/lib/resolve-cart-lines";

import type { CreateOrderLine } from "@/services/prestashop";



export interface CartLineValidation {

  productId: string;

  variantId: string | null;

  ok: boolean;

  message?: string;

}



/** Vérifie existence produit + stock + prix recalculés côté serveur. */

export async function validateCartLines(

  lines: readonly CreateOrderLine[],

): Promise<string | null> {

  const result = await resolveCartLines(lines);

  return result.ok ? null : result.message;

}



export async function validateCartLinesDetailed(
  lines: readonly {
    productId: string;
    variantId: string | null;
    name?: string;
    quantity: number;
    unitPrice?: number;
  }[],
): Promise<CartLineValidation[]> {
  if (!lines.length) return [];

  const mapped: CreateOrderLine[] = lines.map((line) => ({
    productId: line.productId,
    variantId: line.variantId,
    quantity: line.quantity,
    unitPrice: line.unitPrice ?? 0,
    name: line.name,
  }));

  const resolved = await resolveCartLines(mapped);
  if (resolved.ok) {
    return lines.map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      ok: true,
    }));
  }

  const results: CartLineValidation[] = [];
  for (const line of lines) {
    const single = await resolveCartLines([
      {
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
        unitPrice: line.unitPrice ?? 0,
        name: line.name,
      },
    ]);
    results.push({
      productId: line.productId,
      variantId: line.variantId,
      ok: single.ok,
      message: single.ok ? undefined : single.message,
    });
  }

  return results;
}


