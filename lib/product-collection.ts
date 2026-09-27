import type { Product } from "@/types/domain";

/** Produit short (nom contient « short »). */
export function isShortProduct(name: string): boolean {
  return /\bshorts?\b/i.test(name);
}

/** Produit veste (nom contient « veste » / « jacket » / « hoodie »). */
export function isJacketProduct(name: string): boolean {
  return /\b(veste|vestes|jacket|jackets|hoodie|hoodies|sweat)\b/i.test(name);
}

/** Maillot (nom contient « maillot », pas un short ni une veste). */
export function isJerseyProduct(name: string): boolean {
  return (
    /\bmaillot/i.test(name) && !isShortProduct(name) && !isJacketProduct(name)
  );
}

export type ProductCollectionKind = "jersey" | "short" | "jacket";

export const PRODUCT_COLLECTION_KINDS: ProductCollectionKind[] = [
  "jersey",
  "short",
  "jacket",
];

export function collectionKindLabel(kind: ProductCollectionKind): string {
  if (kind === "short") return "Short";
  if (kind === "jacket") return "Veste";
  return "Maillot";
}

type NotifiableProduct = Pick<Product, "name" | "categoryIds" | "defaultCategoryId">;

/** Shorts par catégorie PrestaShop (IDs résolus côté serveur). */
export function isShortCategoryProduct(
  product: NotifiableProduct,
  shortsCategoryIds: ReadonlySet<string>,
): boolean {
  if (shortsCategoryIds.size === 0) return false;
  if (product.defaultCategoryId && shortsCategoryIds.has(product.defaultCategoryId)) {
    return true;
  }
  return product.categoryIds.some((id) => shortsCategoryIds.has(id));
}

export function isJacketCategoryProduct(
  product: NotifiableProduct,
  jacketsCategoryIds: ReadonlySet<string>,
): boolean {
  if (jacketsCategoryIds.size === 0) return false;
  if (
    product.defaultCategoryId &&
    jacketsCategoryIds.has(product.defaultCategoryId)
  ) {
    return true;
  }
  return product.categoryIds.some((id) => jacketsCategoryIds.has(id));
}

/**
 * Produit éligible aux alertes nouveautés (popup + email).
 * Inclut les imports sans « maillot » dans le nom, exclut shorts et vestes.
 */
export function isNotifiableProduct(
  product: NotifiableProduct,
  shortsCategoryIds: ReadonlySet<string> = new Set(),
  jacketsCategoryIds: ReadonlySet<string> = new Set(),
): boolean {
  if (isShortProduct(product.name)) return false;
  if (isJacketProduct(product.name)) return false;
  if (isShortCategoryProduct(product, shortsCategoryIds)) return false;
  if (isJacketCategoryProduct(product, jacketsCategoryIds)) return false;
  return true;
}

export function filterNotifiableProducts(
  products: Product[],
  shortsCategoryIds: ReadonlySet<string> = new Set(),
  jacketsCategoryIds: ReadonlySet<string> = new Set(),
): Product[] {
  return products.filter((product) =>
    isNotifiableProduct(product, shortsCategoryIds, jacketsCategoryIds),
  );
}

export function filterProductsByKind(
  products: Product[],
  kind: ProductCollectionKind,
): Product[] {
  return products.filter((p) => {
    if (kind === "short") return isShortProduct(p.name);
    if (kind === "jacket") return isJacketProduct(p.name);
    return isJerseyProduct(p.name);
  });
}

export function collectionKindFromCategory(
  categoryName: string,
  categoryId: string,
  maillotsCategoryId: string,
  shortsCategoryId: string,
  kidsMaillotsCategoryId = "",
  kidsShortsCategoryId = "",
  jacketsCategoryId = "",
  kidsJacketsCategoryId = "",
): ProductCollectionKind | null {
  if (
    jacketsCategoryId === categoryId ||
    kidsJacketsCategoryId === categoryId ||
    /\b(veste|jacket|hoodie|sweat)\b/i.test(categoryName)
  ) {
    return "jacket";
  }
  if (
    shortsCategoryId === categoryId ||
    kidsShortsCategoryId === categoryId ||
    /\bshorts?\b/i.test(categoryName)
  ) {
    return "short";
  }
  if (
    maillotsCategoryId === categoryId ||
    kidsMaillotsCategoryId === categoryId ||
    /\bmaillot/i.test(categoryName)
  ) {
    return "jersey";
  }
  return null;
}
