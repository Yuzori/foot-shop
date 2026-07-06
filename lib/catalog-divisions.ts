import {
  catalogLeagues,
  type CatalogLeague,
} from "@/config/catalog-leagues";
import type { ProductCollectionKind } from "@/lib/product-collection";

/** Division catalogue (ligue, CDM, etc.) — partagée import + navigation. */
export interface CatalogDivision {
  leagueId: string;
  label: string;
  adultCategoryId?: string;
  kidsNamePatterns: RegExp[];
}

const DIVISION_MATCHERS: Record<
  string,
  { adult: RegExp[]; kids: RegExp[] }
> = {
  "world-cup": {
    adult: [/\bcdm\b/i, /coupe\s*du\s*monde/i, /world\s*cup/i],
    kids: [/\bcdm\b/i, /coupe\s*du\s*monde/i, /world\s*cup/i],
  },
  "ligue-1": {
    adult: [/ligue\s*1/i, /\bl1\b/i],
    kids: [/ligue\s*1/i, /\bl1\b/i],
  },
  "premier-league": {
    adult: [/premier\s*league/i, /\bepl\b/i],
    kids: [/premier\s*league/i, /\bepl\b/i],
  },
  "la-liga": {
    adult: [/la\s*liga/i, /\bliga\b/i],
    kids: [/la\s*liga/i, /\bliga\b/i],
  },
  "serie-a": {
    adult: [/serie\s*a/i],
    kids: [/serie\s*a/i],
  },
  bundesliga: {
    adult: [/bundesliga/i],
    kids: [/bundesliga/i],
  },
  "ligue-des-champions": {
    adult: [
      /ligue\s*des\s*champions/i,
      /champions\s*league/i,
      /\bucl\b/i,
      /\bldc\b/i,
    ],
    kids: [
      /ligue\s*des\s*champions/i,
      /champions\s*league/i,
      /\bucl\b/i,
      /\bldc\b/i,
    ],
  },
  selections: {
    adult: [/sélections?/i, /selections?/i, /nations?/i],
    kids: [/sélections?/i, /selections?/i, /nations?/i],
  },
};

function divisionFromLeague(league: CatalogLeague): CatalogDivision {
  const matchers = DIVISION_MATCHERS[league.id];
  return {
    leagueId: league.id,
    label: league.label,
    adultCategoryId: league.categoryId,
    kidsNamePatterns: matchers?.kids ?? [new RegExp(escapeRegExp(league.label), "i")],
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nameMatchesPatterns(name: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(name));
}

/** Identifie la division à partir de l’ID de catégorie choisi à l’import. */
export function getDivisionForCategoryId(
  categoryId: string,
  categories: readonly { id: string; name: string }[],
): CatalogDivision | null {
  const trimmed = categoryId.trim();
  if (!trimmed) return null;

  const byLeague = catalogLeagues.find((league) => league.categoryId === trimmed);
  if (byLeague) return divisionFromLeague(byLeague);

  const category = categories.find((item) => item.id === trimmed);
  if (!category) return null;

  for (const league of catalogLeagues) {
    const matchers = DIVISION_MATCHERS[league.id];
    if (matchers && nameMatchesPatterns(category.name, matchers.adult)) {
      return divisionFromLeague(league);
    }
  }

  return null;
}

/** Sous-catégorie enfant d’une division (ex. Enfant - Maillots > CDM). */
export function findKidsDivisionCategoryId(
  categories: readonly { id: string; name: string; parentId?: string | null }[],
  kidsBaseCategoryId: string,
  division: CatalogDivision,
): string {
  if (!kidsBaseCategoryId) return "";

  const match = categories.find(
    (category) =>
      category.parentId === kidsBaseCategoryId &&
      nameMatchesPatterns(category.name, division.kidsNamePatterns),
  );
  return match?.id ?? "";
}

export function kidsDivisionCategoryLabel(division: CatalogDivision): string {
  if (division.leagueId === "world-cup") return "CDM";
  return division.label;
}

export function kidsDivisionMissingError(
  kind: ProductCollectionKind,
  division: CatalogDivision,
  kidsBaseLabel: string,
): string {
  const divisionLabel = kidsDivisionCategoryLabel(division);
  const kindLabel = kind === "short" ? "short" : "maillot";
  return (
    `Produit enfant détecté pour la division « ${division.label} » mais sous-catégorie ` +
    `« ${divisionLabel} » introuvable sous « ${kidsBaseLabel} ». ` +
    `Créez Maillot - Enfant > ${divisionLabel} dans PrestaShop ` +
    `(parent = ${kidsBaseLabel}, nom conseillé : ${divisionLabel}).`
  );
}
