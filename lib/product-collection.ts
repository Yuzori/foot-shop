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
