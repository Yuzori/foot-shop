import { catalogConfig } from "@/config/catalog";
import type { CatalogNavCategories } from "@/config/catalog-leagues";
import {
  findCategoryIdByMatcher,
  matchKidsMaillotsCategory,
  matchKidsShortsCategory,
} from "@/lib/catalog-category-match";
import type { Category } from "@/types/domain";

function findCategoryId(
  categories: readonly Category[],
  patterns: string[],
  excludeIds: string[] = [],
): string {
  const match = categories.find((c) => {
    if (excludeIds.includes(c.id)) return false;
    const name = c.name.toLowerCase();
    return patterns.some((p) => new RegExp(`\\b${p}\\b`, "i").test(name));
  });
  return match?.id ?? "";
}

/** Résout les IDs Maillots / Shorts / Enfant (env ou détection par nom). */
export function resolveCatalogNavCategories(
  categories: readonly Category[],
): CatalogNavCategories {
  const maillotsId =
    catalogConfig.maillots.categoryId ||
    findCategoryId(categories, ["maillots?", "jersey", "kit"]);
  const shortsId =
    catalogConfig.shorts.categoryId ||
    findCategoryId(
      categories,
      ["shorts?"],
      maillotsId ? [maillotsId] : [],
    );
  const kidsMaillotsId =
    catalogConfig.kidsMaillots.categoryId ||
    findCategoryIdByMatcher(
      categories,
      matchKidsMaillotsCategory,
      shortsId ? [shortsId] : [],
    );
  const kidsShortsId =
    catalogConfig.kidsShorts.categoryId ||
    findCategoryIdByMatcher(
      categories,
      matchKidsShortsCategory,
      [maillotsId, kidsMaillotsId].filter(Boolean),
    );

  return {
    maillotsCategoryId: maillotsId,
    shortsCategoryId: shortsId,
    kidsMaillotsCategoryId: kidsMaillotsId,
    kidsShortsCategoryId: kidsShortsId,
  };
}
