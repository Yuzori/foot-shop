import type { Product } from "@/types/domain";

/** Le produit est-il commandable (au moins une taille / le stock global) ? */
export function productHasStock(product: Product): boolean {
  if (product.variants.length > 0) {
    return product.variants.some((variant) => variant.inStock);
  }
  return product.inStock;
}

/** Recalcule le stock agrégé depuis les déclinaisons (après applyVariantStock). */
export function syncProductStockFromVariants(product: Product): void {
  if (product.variants.length === 0) return;
  const total = product.variants.reduce(
    (sum, variant) => sum + Math.max(0, variant.quantity),
    0,
  );
  product.quantity = total;
  product.inStock = product.variants.some((variant) => variant.inStock);
}
