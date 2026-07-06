import "server-only";

import { shopConfig } from "@/config/shop";
import { prestashop } from "@/services/prestashop";
import type { CreateOrderLine } from "@/services/prestashop";

const MAX_QTY_PER_LINE = 10;

function validateFlocageFields(
  name: string | undefined,
  number: string | undefined,
  productName: string,
): string | null {
  const n = name?.trim() ?? "";
  const num = number?.trim() ?? "";
  if (!n && !num) return null;

  if (
    n.length < 2 ||
    n.length > shopConfig.flocageNameMax ||
    num.length < shopConfig.flocageNumberMin ||
    num.length > shopConfig.flocageNumberMax
  ) {
    return `Flocage incomplet pour « ${productName} ».`;
  }
  return null;
}

/**
 * Recalcule prix, quantités et flocage depuis PrestaShop.
 * Ignore les montants envoyés par le client.
 */
export async function resolveCartLines(
  lines: readonly CreateOrderLine[],
): Promise<
  { ok: true; lines: CreateOrderLine[] } | { ok: false; message: string }
> {
  if (!lines.length) {
    return { ok: false, message: "Panier vide." };
  }

  const resolved: CreateOrderLine[] = [];

  for (const line of lines) {
    const product = await prestashop.getProductById(line.productId);
    if (!product) {
      return {
        ok: false,
        message: `« ${line.name?.trim() || "Un article"} » n'est plus disponible.`,
      };
    }

    let quantity = Math.floor(Number(line.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
    if (quantity > MAX_QTY_PER_LINE) {
      return {
        ok: false,
        message: `Quantité maximale : ${MAX_QTY_PER_LINE} par article.`,
      };
    }

    let unitPrice = product.price ?? 0;
    let variantId: string | null = line.variantId;

    if (product.optionGroups.length > 0) {
      if (!variantId) {
        return {
          ok: false,
          message: `Choisissez une taille pour « ${product.name} ».`,
        };
      }
      const variant = product.variants.find((v) => v.id === variantId);
      if (!variant) {
        return {
          ok: false,
          message: `La taille pour « ${product.name} » n'existe plus.`,
        };
      }
      if (!variant.inStock || variant.quantity < quantity) {
        return {
          ok: false,
          message: `Stock insuffisant pour « ${product.name} ».`,
        };
      }
      unitPrice = variant.price ?? unitPrice;
    } else {
      variantId = null;
      if (!product.inStock || product.quantity < quantity) {
        return {
          ok: false,
          message: `« ${product.name} » est en rupture de stock.`,
        };
      }
    }

    let flocage: CreateOrderLine["flocage"];
    if (line.flocage) {
      const flocageError = validateFlocageFields(
        line.flocage.name,
        line.flocage.number,
        product.name,
      );
      if (flocageError) return { ok: false, message: flocageError };

      const hasFlocage =
        Boolean(line.flocage.name?.trim()) || Boolean(line.flocage.text?.trim());
      if (hasFlocage) {
        flocage = {
          name: line.flocage.name?.trim(),
          number: line.flocage.number?.trim(),
          text: line.flocage.text?.trim(),
          price: shopConfig.flocagePrice,
        };
        unitPrice += shopConfig.flocagePrice;
      }
    }

    resolved.push({
      productId: line.productId,
      variantId,
      quantity,
      unitPrice: Math.round(unitPrice * 100) / 100,
      name: product.name,
      flocage,
    });
  }

  return { ok: true, lines: resolved };
}
