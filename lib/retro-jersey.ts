import { importExtraCategories, importKidsExtraCategories } from "@/config/import-extra-categories";

const RETRO_NAME_RE =
  /\b(maillot\s*retro|maillot\s*r[eé]tro|myoretro|vintage|classique\s*r[eé]tro)\b/i;

function retroCategoryIds(): Set<string> {
  return new Set(
    [
      importExtraCategories.maillotRetro,
      importKidsExtraCategories.maillotRetro,
      process.env.NEXT_PUBLIC_MAILLOT_RETRO_CATEGORY_ID,
      process.env.NEXT_PUBLIC_ENFANT_MAILLOT_RETRO_CATEGORY_ID,
    ]
      .map((id) => String(id ?? "").trim())
      .filter(Boolean),
  );
}

type RetroProduct = {
  name: string;
  categoryIds?: string[];
  defaultCategoryId?: string | null;
};

/** Maillot rétro — pas de flocage disponible. */
export function isRetroJersey(product: RetroProduct): boolean {
  if (!/\bmaillot/i.test(product.name) || /\bshorts?\b/i.test(product.name)) {
    return false;
  }

  if (RETRO_NAME_RE.test(product.name)) return true;

  const retroIds = retroCategoryIds();
  if (retroIds.size === 0) return false;

  const defaultId = String(product.defaultCategoryId ?? "").trim();
  if (defaultId && retroIds.has(defaultId)) return true;

  return (product.categoryIds ?? []).some((id) => retroIds.has(String(id).trim()));
}

/** @deprecated Utiliser isRetroJersey — le flocage n’est jamais obligatoire. */
export function requiresRetroFlocage(product: RetroProduct): boolean {
  return false;
}
