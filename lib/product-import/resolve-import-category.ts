import "server-only";

import { catalogLeagues } from "@/config/catalog-leagues";
import { catalogConfig } from "@/config/catalog";
import {
  findCategoryIdByMatcher,
  matchKidsMaillotsCategory,
  matchKidsShortsCategory,
} from "@/lib/catalog-category-match";
import {
  getDivisionForCategoryId,
  detectDivisionFromProductText,
  findKidsDivisionCategoryId,
} from "@/lib/catalog-divisions";
import type { ProductAudience } from "@/lib/product-import/format-product-name";
import type { ProductCollectionKind } from "@/lib/product-collection";
import {
  resolveExtraKidsCategoryId,
} from "@/lib/product-import/import-category-signals";
import type { ImportKidsExtraCategoryKey } from "@/config/import-extra-categories";
import { prestashop } from "@/services/prestashop";
import { normalizeCategoryId } from "@/lib/product-import/normalize-category-id";

const EXTRA_LEAGUE_TO_KEY: Partial<Record<string, ImportKidsExtraCategoryKey>> = {
  "maillot-concept": "maillotConcept",
  "maillot-retro": "maillotRetro",
  "reste-du-monde": "resteDuMonde",
};

let kidsCategoryCache: {
  maillots: string;
  shorts: string;
} | null = null;

async function loadKidsCategoryIds(): Promise<{
  maillots: string;
  shorts: string;
}> {
  if (kidsCategoryCache) return kidsCategoryCache;

  const fromEnv = {
    maillots: catalogConfig.kidsMaillots.categoryId,
    shorts: catalogConfig.kidsShorts.categoryId,
  };

  if (fromEnv.maillots && fromEnv.shorts) {
    kidsCategoryCache = fromEnv;
    return fromEnv;
  }

  const categories = await prestashop.getCategories();
  const maillots =
    fromEnv.maillots ||
    findCategoryIdByMatcher(categories, matchKidsMaillotsCategory);
  const shorts =
    fromEnv.shorts ||
    findCategoryIdByMatcher(categories, matchKidsShortsCategory, maillots
      ? [maillots]
      : []);

  kidsCategoryCache = { maillots, shorts };
  return kidsCategoryCache;
}

function resolveKidsDivisionCategoryId(
  divisionLeagueId: string,
  categories: readonly { id: string; name: string; parentId?: string | null }[],
  kidsBaseId: string,
  kidsShortsBaseId: string,
): string {
  const league = catalogLeagues.find((item) => item.id === divisionLeagueId);
  if (league?.kidsCategoryId) {
    const hit = categories.find((c) => c.id === league.kidsCategoryId);
    if (hit && String(hit.parentId ?? "").trim() === String(kidsBaseId).trim()) {
      return league.kidsCategoryId;
    }
  }

  const extraKey = EXTRA_LEAGUE_TO_KEY[divisionLeagueId];
  if (extraKey) {
    const extraId = resolveExtraKidsCategoryId(
      extraKey,
      categories,
      kidsBaseId,
      kidsShortsBaseId,
    );
    if (extraId) return extraId;
  }

  return "";
}

/**
 * Catégorie PrestaShop à l’import :
 * - adulte → catégorie de division choisie
 * - enfant → sous-catégorie enfant (ligue, concept, retro, reste du monde…)
 * - si introuvable → catégorie enfant de base (pas d’échec bloquant)
 */
export async function resolveImportCategoryForProduct(
  kind: ProductCollectionKind,
  audience: ProductAudience,
  divisionCategoryId: string | number,
  productName?: string,
): Promise<string> {
  if (audience !== "kids") return normalizeCategoryId(divisionCategoryId);

  const categories = await prestashop.getCategories();
  const kids = await loadKidsCategoryIds();
  const kidsBaseId = kind === "short" ? kids.shorts : kids.maillots;
  const kidsShortsBaseId = kids.shorts;

  if (!kidsBaseId) {
    throw new Error(
      `Produit enfant détecté mais catégorie « ${kind === "short" ? catalogConfig.kidsShorts.label : catalogConfig.kidsMaillots.label} » introuvable dans PrestaShop. ` +
        "Créez-la ou renseignez NEXT_PUBLIC_ENFANT_MAILLOTS_CATEGORY_ID / NEXT_PUBLIC_ENFANT_SHORTS_CATEGORY_ID.",
    );
  }

  const trimmedCategoryId = normalizeCategoryId(divisionCategoryId);
  const selected = categories.find((item) => item.id === trimmedCategoryId);

  if (
    selected &&
    String(selected.parentId ?? "").trim() === String(kidsBaseId).trim()
  ) {
    return trimmedCategoryId;
  }

  let division = getDivisionForCategoryId(trimmedCategoryId, categories);
  if (!division && productName?.trim()) {
    division = detectDivisionFromProductText(productName);
  }

  if (!division) return kidsBaseId;

  const fromLeague = resolveKidsDivisionCategoryId(
    division.leagueId,
    categories,
    kidsBaseId,
    kidsShortsBaseId,
  );
  if (fromLeague) return fromLeague;

  const kidsDivisionId = findKidsDivisionCategoryId(
    categories,
    kidsBaseId,
    division,
  );
  if (kidsDivisionId) return kidsDivisionId;

  console.warn(
    `[import] sous-catégorie enfant « ${division.label} » introuvable sous ${kidsBaseId} — fallback base enfant`,
  );
  return kidsBaseId;
}
