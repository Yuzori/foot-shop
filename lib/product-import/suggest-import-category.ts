import { catalogConfig } from "@/config/catalog";
import { findCategoryLabel } from "@/lib/admin/import-category-tree";
import type { AdminCategoryOptGroup } from "@/lib/admin/import-category-tree";
import {
  findCategoryIdByMatcher,
  matchKidsMaillotsCategory,
  matchKidsShortsCategory,
} from "@/lib/catalog-category-match";
import {
  detectDivisionFromProductText,
  findAdultDivisionCategoryId,
  findKidsDivisionCategoryId,
  kidsDivisionCategoryLabel,
} from "@/lib/catalog-divisions";
import type { ProductAudience } from "@/lib/product-import/format-product-name";
import type { ProductCollectionKind } from "@/lib/product-collection";

export interface ImportCategorySuggestion {
  categoryId: string;
  label: string;
  reason: string;
}

type CategoryRow = {
  id: string;
  name: string;
  parentId?: string | null;
};

function resolveMaillotsBaseId(categories: readonly CategoryRow[]): string {
  const configured = catalogConfig.maillots.categoryId.trim();
  if (configured) return configured;
  return findCategoryIdByMatcher(
    categories,
    (name) => /\bmaillots?\b/i.test(name) && !/\benfant\b/i.test(name),
  );
}

function resolveShortsBaseId(categories: readonly CategoryRow[]): string {
  const configured = catalogConfig.shorts.categoryId.trim();
  if (configured) return configured;
  return findCategoryIdByMatcher(
    categories,
    (name) => /\bshorts?\b/i.test(name) && !/\benfant\b/i.test(name),
  );
}

function resolveKidsMaillotsBaseId(categories: readonly CategoryRow[]): string {
  const configured = catalogConfig.kidsMaillots.categoryId.trim();
  if (configured) return configured;
  return findCategoryIdByMatcher(categories, matchKidsMaillotsCategory);
}

function resolveKidsShortsBaseId(categories: readonly CategoryRow[]): string {
  const configured = catalogConfig.kidsShorts.categoryId.trim();
  if (configured) return configured;
  const kidsMaillotsId = resolveKidsMaillotsBaseId(categories);
  return findCategoryIdByMatcher(
    categories,
    matchKidsShortsCategory,
    kidsMaillotsId ? [kidsMaillotsId] : [],
  );
}

function formatCategoryLabel(
  categoryId: string,
  categories: readonly CategoryRow[],
  optGroups?: readonly AdminCategoryOptGroup[],
): string {
  if (optGroups?.length) {
    const fromTree = findCategoryLabel(optGroups, categoryId);
    if (fromTree !== categoryId) return fromTree;
  }

  const category = categories.find((item) => item.id === categoryId);
  if (!category) return categoryId;

  const parentId = String(category.parentId ?? "").trim();
  const parent = parentId
    ? categories.find((item) => item.id === parentId)
    : undefined;
  return parent ? `${parent.name} — ${category.name}` : category.name;
}

/**
 * Suggère une catégorie PrestaShop à partir du titre, de la description et de l’audience.
 * L’utilisateur peut toujours choisir une autre catégorie dans l’interface.
 */
export function suggestImportCategory(params: {
  title: string;
  sourceUrl?: string;
  audience: ProductAudience;
  kind: ProductCollectionKind;
  categories: readonly CategoryRow[];
  optGroups?: readonly AdminCategoryOptGroup[];
}): ImportCategorySuggestion | null {
  const { title, sourceUrl, audience, kind, categories, optGroups } = params;
  const division = detectDivisionFromProductText(
    `${title}\n${sourceUrl ?? ""}`,
  );
  if (!division) return null;

  const divisionLabel = kidsDivisionCategoryLabel(division);

  if (audience === "kids") {
    const kidsBaseId =
      kind === "short"
        ? resolveKidsShortsBaseId(categories)
        : resolveKidsMaillotsBaseId(categories);
    if (!kidsBaseId) return null;

    const kidsDivisionId = findKidsDivisionCategoryId(
      categories,
      kidsBaseId,
      division,
    );
    const categoryId = kidsDivisionId || kidsBaseId;
    const label = formatCategoryLabel(categoryId, categories, optGroups);

    return {
      categoryId,
      label,
      reason: kidsDivisionId
        ? `Maillot enfant · ${divisionLabel}`
        : "Maillot enfant",
    };
  }

  if (division.adultCategoryId) {
    const categoryId = division.adultCategoryId;
    return {
      categoryId,
      label: formatCategoryLabel(categoryId, categories, optGroups),
      reason: division.label,
    };
  }

  const adultBaseId =
    kind === "short" ? resolveShortsBaseId(categories) : resolveMaillotsBaseId(categories);
  const adultDivisionId = findAdultDivisionCategoryId(
    categories,
    adultBaseId,
    division,
  );
  if (!adultDivisionId) return null;

  return {
    categoryId: adultDivisionId,
    label: formatCategoryLabel(adultDivisionId, categories, optGroups),
    reason: division.label,
  };
}
