import type { Product } from "@/types/domain";

/** Produit short (nom contient « short »). */
export function isShortProduct(name: string): boolean {
  return /\bshorts?\b/i.test(name);
}

/** Maillot (nom contient « maillot », pas un short). */
export function isJerseyProduct(name: string): boolean {
  return /\bmaillot/i.test(name) && !isShortProduct(name);
}

export type ProductCollectionKind = "jersey" | "short";

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

/**
 * Produit éligible aux alertes nouveautés (popup + email).
 * Inclut les imports sans « maillot » dans le nom, exclut les shorts.
 */
export function isNotifiableProduct(
  product: NotifiableProduct,
  shortsCategoryIds: ReadonlySet<string> = new Set(),
): boolean {
  if (isShortProduct(product.name)) return false;
  if (isShortCategoryProduct(product, shortsCategoryIds)) return false;
  return true;
}

export function filterNotifiableProducts(
  products: Product[],
  shortsCategoryIds: ReadonlySet<string> = new Set(),
): Product[] {
  return products.filter((product) =>
    isNotifiableProduct(product, shortsCategoryIds),
  );
}

export function filterProductsByKind(
  products: Product[],
  kind: ProductCollectionKind,
): Product[] {
  return products.filter((p) =>
    kind === "short" ? isShortProduct(p.name) : isJerseyProduct(p.name),
  );
}

export function collectionKindFromCategory(
  categoryName: string,
  categoryId: string,
  maillotsCategoryId: string,
  shortsCategoryId: string,
  kidsMaillotsCategoryId = "",
  kidsShortsCategoryId = "",
): ProductCollectionKind | null {
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
