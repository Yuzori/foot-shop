import type { Product, ProductVariant } from "@/types/domain";

function asPositivePrice(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

/** Prix affichable : produit de base ou plus petit prix déclinaison. */
export function effectiveProductPrice(
  product: Pick<Product, "price" | "variants">,
  variant?: ProductVariant | null,
): number {
  const fromVariant = asPositivePrice(variant?.price);
  if (fromVariant != null) return fromVariant;

  const fromProduct = asPositivePrice(product.price);
  if (fromProduct != null) return fromProduct;

  const variantPrices = (product.variants ?? [])
    .map((v) => asPositivePrice(v.price))
    .filter((p): p is number => p != null);
  if (variantPrices.length > 0) return Math.min(...variantPrices);

  return 0;
}

/** Aligne product.price sur les déclinaisons si le prix catalogue est absent. */
export function syncProductPriceFromVariants(product: Product): void {
  if (product.price > 0) return;
  const price = effectiveProductPrice(product);
  if (price > 0) product.price = price;
}
