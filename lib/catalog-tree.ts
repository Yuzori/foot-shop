import type { Category } from "@/types/domain";
import type { Product } from "@/types/domain";

const HOME_PARENT_IDS = new Set(["2"]);

function normalizeId(id: string | null | undefined): string {
  if (id == null || id === "") return "";
  return String(id).trim();
}

/** IDs des catégories racines boutique (Accueil / Home). */
export function getStorefrontRootParentIds(
  categories: readonly Category[],
): Set<string> {
  const roots = new Set(HOME_PARENT_IDS);
  for (const category of categories) {
    if (category.isRoot || /^(accueil|home)$/i.test(category.name.trim())) {
      roots.add(category.id);
    }
  }
  return roots;
}

/** Sous-catégorie (parent ≠ Accueil / Home). */
export function isStorefrontSubcategory(
  category: Category,
  categories: readonly Category[],
): boolean {
  if (category.isRoot || !category.parentId || category.parentId === "0") {
    return false;
  }
  const roots = getStorefrontRootParentIds(categories);
  return !roots.has(category.parentId);
}

/** Catégories de premier niveau — pas les sous-catégories (ex. CDM). */
export function filterShowcaseCategories(
  categories: readonly Category[],
  kidsMaillotsId = "",
  kidsShortsId = "",
): Category[] {
  const roots = getStorefrontRootParentIds(categories);
  const kidsRoots = new Set(
    [kidsMaillotsId, kidsShortsId].filter(Boolean),
  );

  return categories.filter((category) => {
    if (category.isRoot) return false;
    if (!category.parentId || category.parentId === "0") return false;
    if (kidsRoots.has(category.parentId)) return false;
    return roots.has(category.parentId);
  });
}

/** Tous les descendants d’une catégorie (elle-même incluse). */
export function getCategoryDescendantIds(
  categories: readonly Category[],
  categoryId: string,
): Set<string> {
  const ids = new Set<string>([normalizeId(categoryId)]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) {
      if (
        category.parentId &&
        ids.has(normalizeId(category.parentId)) &&
        !ids.has(normalizeId(category.id))
      ) {
        ids.add(normalizeId(category.id));
        changed = true;
      }
    }
  }
  return ids;
}

function categoryHasChildren(
  categories: readonly Category[],
  categoryId: string,
): boolean {
  return categories.some((category) => category.parentId === categoryId);
}

/**
 * Filtre les produits d’une page catégorie.
 * - Feuille (ex. CDM) : strict sur cette catégorie.
 * - Parent (ex. Maillot - Enfant) : produits de l’arborescence uniquement.
 */
export function filterProductsByCategoryScope(
  products: readonly Product[],
  categoryId: string,
  categories: readonly Category[],
): Product[] {
  const descendants = getCategoryDescendantIds(categories, categoryId);
  const isLeaf = !categoryHasChildren(categories, categoryId);

  if (isLeaf) {
    return products.filter((product) => {
      const def = normalizeId(product.defaultCategoryId);
      const cat = normalizeId(categoryId);
      return (
        def === cat ||
        product.categoryIds.some((id) => normalizeId(id) === cat)
      );
    });
  }

  return products.filter((product) => {
    const def = normalizeId(product.defaultCategoryId);
    if (def && descendants.has(def)) return true;
    return product.categoryIds.some((id) => descendants.has(normalizeId(id)));
  });
}

export function isKidsProductName(name: string): boolean {
  return /\b(enfant|junior|kids?)\b/i.test(name);
}

/** Filtre audience enfant / adulte selon le nom produit. */
export function filterProductsByAudience(
  products: readonly Product[],
  audience: "kids" | "adult",
): Product[] {
  return products.filter((product) =>
    audience === "kids"
      ? isKidsProductName(product.name)
      : !isKidsProductName(product.name),
  );
}

export function collectKidsCategoryIds(
  categories: readonly Category[],
  kidsMaillotsId: string,
  kidsShortsId: string,
): Set<string> {
  const ids = new Set<string>();
  for (const baseId of [kidsMaillotsId, kidsShortsId]) {
    if (!baseId) continue;
    for (const id of getCategoryDescendantIds(categories, baseId)) {
      ids.add(id);
    }
  }
  return ids;
}

export function isKidsCategoryId(
  categoryId: string,
  categories: readonly Category[],
  kidsMaillotsId: string,
  kidsShortsId: string,
): boolean {
  return collectKidsCategoryIds(categories, kidsMaillotsId, kidsShortsId).has(
    categoryId,
  );
}
