import { worldCupConfig } from "@/config/world-cup";

const HOME_CATEGORY_IDS = new Set(["1", "2"]);

function isHomeCategory(id: string, name: string): boolean {
  if (HOME_CATEGORY_IDS.has(id)) return true;
  return /^(accueil|home|racine|root)$/i.test(name.trim());
}

/** Choisit la meilleure catégorie par défaut pour l'import (évite Accueil). */
export function pickImportDefaultCategoryId(
  categories: readonly { id: string; name: string }[],
  configuredId = "",
): string {
  const trimmed = configuredId.trim();
  if (trimmed && !HOME_CATEGORY_IDS.has(trimmed)) return trimmed;

  const worldCup = categories.find((c) => c.id === worldCupConfig.categoryId);
  if (worldCup) return worldCup.id;

  const namedWorldCup = categories.find((c) =>
    /world\s*cup|coupe\s*du\s*monde/i.test(c.name),
  );
  if (namedWorldCup) return namedWorldCup.id;

  const firstUseful = categories.find((c) => !isHomeCategory(c.id, c.name));
  return firstUseful?.id ?? trimmed ?? categories[0]?.id ?? "";
}
