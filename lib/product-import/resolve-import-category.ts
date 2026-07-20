import "server-only";



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

  kidsDivisionMissingError,

} from "@/lib/catalog-divisions";

import type { ProductAudience } from "@/lib/product-import/format-product-name";

import type { ProductCollectionKind } from "@/lib/product-collection";

import { prestashop } from "@/services/prestashop";

import { normalizeCategoryId } from "@/lib/product-import/normalize-category-id";



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



/**

 * Catégorie PrestaShop à l’import :

 * - adulte → catégorie de division choisie (ex. Coupe du monde)

 * - enfant + division → sous-catégorie enfant de la division (ex. Enfant - Maillots > CDM)

 * - enfant sans division reconnue → Enfant - Maillots / Enfant - Short

 */

export async function resolveImportCategoryForProduct(

  kind: ProductCollectionKind,

  audience: ProductAudience,

  divisionCategoryId: string | number,

  productName?: string,

): Promise<string> {

  if (audience !== "kids") return divisionCategoryId;



  const categories = await prestashop.getCategories();

  const kids = await loadKidsCategoryIds();

  const kidsBaseId = kind === "short" ? kids.shorts : kids.maillots;

  const kidsBaseLabel =

    kind === "short"

      ? catalogConfig.kidsShorts.label

      : catalogConfig.kidsMaillots.label;



  if (!kidsBaseId) {

    throw new Error(

      `Produit enfant détecté mais catégorie « ${kidsBaseLabel} » introuvable dans PrestaShop. ` +

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



  const kidsDivisionId = findKidsDivisionCategoryId(

    categories,

    kidsBaseId,

    division,

  );

  if (!kidsDivisionId) {

    throw new Error(kidsDivisionMissingError(kind, division, kidsBaseLabel));

  }



  return kidsDivisionId;

}


