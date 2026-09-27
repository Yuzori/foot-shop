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

function matchKidsJacketsCategory(name: string): boolean {
  return (
    /\b(veste|vestes|jacket|jackets|hoodie|sweat)\b/i.test(name) &&
    /\b(enfant|kids?|junior|garçon|garcon|fille|boys?|girls?)\b/i.test(name)
  );
}

/** Résout les IDs Maillots / Shorts / Vestes / Enfant (env ou détection par nom). */
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
  const jacketsId =
    catalogConfig.jackets.categoryId ||
    findCategoryId(
      categories,
      ["vestes?", "jackets?", "hoodies?"],
      [maillotsId, shortsId].filter(Boolean),
    );
  const kidsMaillotsId =
    catalogConfig.kidsMaillots.categoryId ||
    findCategoryIdByMatcher(
      categories,
      matchKidsMaillotsCategory,
      [shortsId, jacketsId].filter(Boolean),
    );
  const kidsShortsId =
    catalogConfig.kidsShorts.categoryId ||
    findCategoryIdByMatcher(
      categories,
      matchKidsShortsCategory,
      [maillotsId, kidsMaillotsId, jacketsId].filter(Boolean),
    );
  const kidsJacketsId =
    catalogConfig.kidsJackets.categoryId ||
    findCategoryIdByMatcher(
      categories,
      matchKidsJacketsCategory,
      [maillotsId, shortsId, kidsMaillotsId, kidsShortsId].filter(Boolean),
    );

  return {
    maillotsCategoryId: maillotsId,
    shortsCategoryId: shortsId,
    jacketsCategoryId: jacketsId,
    kidsMaillotsCategoryId: kidsMaillotsId,
    kidsShortsCategoryId: kidsShortsId,
    kidsJacketsCategoryId: kidsJacketsId,
  };
}
