import { worldCupConfig } from "@/config/world-cup";
import type { Product } from "@/types/domain";

/** Produit rattaché à la catégorie World Cup (nav active). */
export function isWorldCupProduct(product: Pick<Product, "categoryIds" | "defaultCategoryId">): boolean {
  const wcId = String(worldCupConfig.categoryId);
  if (String(product.defaultCategoryId ?? "") === wcId) return true;
  return product.categoryIds.some((id) => String(id) === wcId);
}
