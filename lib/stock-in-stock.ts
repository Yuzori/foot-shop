import type { Product } from "@/types/domain";

/** Vérifie si l'alerte stock doit être déclenchée (taille / variante précise). */
export function isStockAlertFulfilled(
  product: Product,
  variantId: string | null,
  variantLabel: string | null,
): boolean {
  if (variantId) {
    const variant = product.variants.find(
      (v) => String(v.id) === String(variantId),
    );
    if (variant?.inStock) return true;

    if (variantLabel) {
      return product.variants.some(
        (v) =>
          v.inStock &&
          v.options.some(
            (o) => o.label.toLowerCase() === variantLabel.toLowerCase(),
          ),
      );
    }

    return false;
  }

  if (variantLabel && product.variants.length > 0) {
    return product.variants.some(
      (v) =>
        v.inStock &&
        v.options.some(
          (o) => o.label.toLowerCase() === variantLabel.toLowerCase(),
        ),
    );
  }

  if (product.variants.length > 0) {
    return product.variants.some((v) => v.inStock);
  }

  return product.inStock;
}
