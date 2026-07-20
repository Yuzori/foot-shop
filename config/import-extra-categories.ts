function envFirst(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

/**
 * Catégories PrestaShop spéciales pour l'import (hors divisions ligues).
 * Renseignez les IDs après création SQL, ou laissez vide pour détection par nom.
 */
export const importExtraCategories = {
  resteDuMonde: envFirst("PRODUCT_IMPORT_RESTE_MONDE_CATEGORY_ID"),
  maillotConcept: envFirst(
    "PRODUCT_IMPORT_MAILLOT_CONCEPT_CATEGORY_ID",
    "PRODUCT_IMPORT_MYOCONCEPT_CATEGORY_ID",
  ),
  maillotRetro: envFirst(
    "PRODUCT_IMPORT_MAILLOT_RETRO_CATEGORY_ID",
    "PRODUCT_IMPORT_MYORETRO_CATEGORY_ID",
  ),
} as const;

/** Sous-catégories enfant (Maillot - Enfant / Enfant - Short). */
export const importKidsExtraCategories = {
  resteDuMonde: envFirst(
    "PRODUCT_IMPORT_ENFANT_MAILLOT_RESTE_MONDE_CATEGORY_ID",
    "NEXT_PUBLIC_ENFANT_MAILLOT_RESTE_MONDE_CATEGORY_ID",
  ),
  maillotConcept: envFirst(
    "PRODUCT_IMPORT_ENFANT_MAILLOT_CONCEPT_CATEGORY_ID",
    "NEXT_PUBLIC_ENFANT_MAILLOT_CONCEPT_CATEGORY_ID",
  ),
  maillotRetro: envFirst(
    "PRODUCT_IMPORT_ENFANT_MAILLOT_RETRO_CATEGORY_ID",
    "NEXT_PUBLIC_ENFANT_MAILLOT_RETRO_CATEGORY_ID",
  ),
} as const;

/** Sous-catégories enfant sous Enfant - Short (optionnel — sinon détection par nom + parent). */
export const importKidsShortsExtraCategories = {
  resteDuMonde: envFirst("PRODUCT_IMPORT_ENFANT_SHORT_RESTE_MONDE_CATEGORY_ID"),
  maillotConcept: envFirst("PRODUCT_IMPORT_ENFANT_SHORT_MAILLOT_CONCEPT_CATEGORY_ID"),
  maillotRetro: envFirst("PRODUCT_IMPORT_ENFANT_SHORT_MAILLOT_RETRO_CATEGORY_ID"),
} as const;

export type ImportExtraCategoryKey = keyof typeof importExtraCategories;
export type ImportKidsExtraCategoryKey = keyof typeof importKidsExtraCategories;
export type ImportKidsShortsExtraCategoryKey = keyof typeof importKidsShortsExtraCategories;
