import "server-only";

import { normalizeCategoryId } from "@/lib/product-import/normalize-category-id";

type CategoryRow = { id: string; parentId?: string | null };

/** Chaîne catégorie → parents (feuille d'abord) pour les associations PrestaShop. */
export function buildCategoryAssociationIds(
  categoryId: string | number,
  categories: readonly CategoryRow[],
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  let current = normalizeCategoryId(categoryId);

  while (current && !seen.has(current)) {
    seen.add(current);
    ids.push(current);
    const category = categories.find((item) => item.id === current);
    const parentId = String(category?.parentId ?? "").trim();
    if (!parentId || parentId === "0") break;
    current = parentId;
  }

  return ids;
}
