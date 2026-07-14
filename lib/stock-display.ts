import { shopConfig } from "@/config/shop";
import type { Product, ProductVariant } from "@/types/domain";

/** Stock total toutes tailles confondues. */
export function totalVariantStock(product: Product): number {
  if (product.variants.length > 0) {
    return product.variants.reduce(
      (sum, variant) => sum + Math.max(0, variant.quantity),
      0,
    );
  }
  return Math.max(0, product.quantity);
}

export function stockForVariant(variant: ProductVariant | null, product: Product): number {
  if (variant) return Math.max(0, variant.quantity);
  return totalVariantStock(product);
}

export function isLowStock(quantity: number): boolean {
  return quantity > 0 && quantity <= shopConfig.lowStockThreshold;
}

/** Afficher le badge stock uniquement entre 0 et stockDisplayMax inclus. */
export function shouldShowStockQuantity(quantity: number): boolean {
  return quantity >= 0 && quantity <= shopConfig.stockDisplayMax;
}

export function stockLabel(quantity: number): string {
  if (quantity <= 0) return "Rupture de stock";
  if (isLowStock(quantity)) return `Bientôt épuisé (${quantity})`;
  if (quantity <= shopConfig.stockDisplayMax) return `En stock (${quantity})`;
  return "En stock";
}

/** Ratio 0 (épuisé) → 1 (stock confortable). */
export function stockRatio(quantity: number): number {
  const max = Math.max(1, shopConfig.stockColorReferenceMax);
  return Math.min(1, Math.max(0, quantity / max));
}

/** Couleurs du dégradé selon le niveau de stock. */
export function stockGradient(quantity: number): { from: string; to: string } {
  const ratio = stockRatio(quantity);
  if (ratio > 0.6) return { from: "#047857", to: "#10b981" };
  if (ratio > 0.3) return { from: "#b45309", to: "#f59e0b" };
  return { from: "#b91c1c", to: "#e11d48" };
}
