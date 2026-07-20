import { routes } from "@/config/site";
import {
  importExtraCategories,
  importKidsExtraCategories,
} from "@/config/import-extra-categories";
import { worldCupConfig } from "@/config/world-cup";
import {
  catalogDivisionFromLeague,
  findAdultDivisionCategoryId,
  findKidsDivisionCategoryId,
  getDivisionForCategoryId,
} from "@/lib/catalog-divisions";

export type CatalogKind = "jersey" | "short";
export type CatalogAudience = "adult" | "kids";

export interface CatalogLeague {
  id: string;
  label: string;
  /** Chemin logo dans public/, ex. /leagues/ligue1.png */
  icon: string;
  categoryId?: string;
  /** Sous-catégorie enfant directe (ex. Maillot - Enfant > Maillot Concept). */
  kidsCategoryId?: string;
}

export interface CatalogNavCategories {
  maillotsCategoryId: string;
  shortsCategoryId: string;
  kidsMaillotsCategoryId: string;
  kidsShortsCategoryId: string;
}

export const catalogAudiences: { id: CatalogAudience; label: string }[] = [
  { id: "adult", label: "Adulte" },
  { id: "kids", label: "Enfant" },
];

function envFirst(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

const DIVISION_CATEGORY_IDS: Record<
  string,
  { adult?: string; kids?: string }
> = {
  "ligue-1": {
    adult: envFirst("NEXT_PUBLIC_LIGUE_1_CATEGORY_ID") || "17",
    kids: envFirst("NEXT_PUBLIC_LIGUE_1_ENFANT_CATEGORY_ID") || "24",
  },
  "premier-league": {
    adult: envFirst("NEXT_PUBLIC_PREMIER_LEAGUE_CATEGORY_ID") || "18",
    kids: envFirst("NEXT_PUBLIC_PREMIER_LEAGUE_ENFANT_CATEGORY_ID") || "25",
  },
  "la-liga": {
    adult: envFirst("NEXT_PUBLIC_LA_LIGA_CATEGORY_ID") || "19",
    kids: envFirst("NEXT_PUBLIC_LA_LIGA_ENFANT_CATEGORY_ID") || "26",
  },
  "serie-a": {
    adult: envFirst("NEXT_PUBLIC_SERIE_A_CATEGORY_ID") || "20",
    kids: envFirst("NEXT_PUBLIC_SERIE_A_ENFANT_CATEGORY_ID") || "27",
  },
  bundesliga: {
    adult: envFirst("NEXT_PUBLIC_BUNDESLIGA_CATEGORY_ID") || "21",
    kids: envFirst("NEXT_PUBLIC_BUNDESLIGA_ENFANT_CATEGORY_ID") || "28",
  },
  "ligue-des-champions": {
    adult: envFirst("NEXT_PUBLIC_LDC_CATEGORY_ID") || "22",
    kids: envFirst("NEXT_PUBLIC_LDC_ENFANT_CATEGORY_ID") || "29",
  },
  selections: {
    adult: envFirst("NEXT_PUBLIC_SELECTIONS_CATEGORY_ID") || "23",
    kids: envFirst("NEXT_PUBLIC_SELECTIONS_ENFANT_CATEGORY_ID") || "30",
  },
};

function buildMaillotSpecialCatalogLeagues(): CatalogLeague[] {
  const conceptAdultId =
    importExtraCategories.maillotConcept ||
    envFirst("NEXT_PUBLIC_MAILLOT_CONCEPT_CATEGORY_ID");
  const retroAdultId =
    importExtraCategories.maillotRetro ||
    envFirst("NEXT_PUBLIC_MAILLOT_RETRO_CATEGORY_ID");
  const resteDuMondeId = importExtraCategories.resteDuMonde;

  const conceptKidsId =
    importKidsExtraCategories.maillotConcept ||
    envFirst("NEXT_PUBLIC_ENFANT_MAILLOT_CONCEPT_CATEGORY_ID");
  const retroKidsId =
    importKidsExtraCategories.maillotRetro ||
    envFirst("NEXT_PUBLIC_ENFANT_MAILLOT_RETRO_CATEGORY_ID");

  const resteKidsId =
    envFirst("NEXT_PUBLIC_ENFANT_MAILLOT_RESTE_MONDE_CATEGORY_ID");

  const leagues: CatalogLeague[] = [
    {
      id: "maillot-concept",
      label: "Maillot Concept",
      icon: "/leagues/selections.png",
      categoryId: conceptAdultId || undefined,
      kidsCategoryId: conceptKidsId || undefined,
    },
    {
      id: "maillot-retro",
      label: "Maillot Retro",
      icon: "/leagues/selections.png",
      categoryId: retroAdultId || undefined,
      kidsCategoryId: retroKidsId || undefined,
    },
  ];

  if (resteDuMondeId) {
    leagues.push({
      id: "reste-du-monde",
      label: "Le reste du monde",
      icon: "/leagues/selections.png",
      categoryId: resteDuMondeId,
      kidsCategoryId: resteKidsId || undefined,
    });
  }

  return leagues;
}

export const catalogLeagues: CatalogLeague[] = [
  {
    id: "world-cup",
    label: "World Cup",
    icon: "/leagues/world-cup.png",
    categoryId: worldCupConfig.categoryId,
  },
  { id: "ligue-1", label: "Ligue 1", icon: "/leagues/ligue1.png", categoryId: DIVISION_CATEGORY_IDS["ligue-1"]?.adult, kidsCategoryId: DIVISION_CATEGORY_IDS["ligue-1"]?.kids },
  {
    id: "premier-league",
    label: "Premier League",
    icon: "/leagues/premier-league.png",
    categoryId: DIVISION_CATEGORY_IDS["premier-league"]?.adult,
    kidsCategoryId: DIVISION_CATEGORY_IDS["premier-league"]?.kids,
  },
  { id: "la-liga", label: "La Liga", icon: "/leagues/la-liga.png", categoryId: DIVISION_CATEGORY_IDS["la-liga"]?.adult, kidsCategoryId: DIVISION_CATEGORY_IDS["la-liga"]?.kids },
  { id: "serie-a", label: "Serie A", icon: "/leagues/serie-a.png", categoryId: DIVISION_CATEGORY_IDS["serie-a"]?.adult, kidsCategoryId: DIVISION_CATEGORY_IDS["serie-a"]?.kids },
  { id: "bundesliga", label: "Bundesliga", icon: "/leagues/bundesliga.png", categoryId: DIVISION_CATEGORY_IDS.bundesliga?.adult, kidsCategoryId: DIVISION_CATEGORY_IDS.bundesliga?.kids },
  {
    id: "ligue-des-champions",
    label: "Ligue des champions",
    icon: "/leagues/champions-league.png",
    categoryId: DIVISION_CATEGORY_IDS["ligue-des-champions"]?.adult,
    kidsCategoryId: DIVISION_CATEGORY_IDS["ligue-des-champions"]?.kids,
  },
  { id: "selections", label: "Sélections", icon: "/leagues/selections.png", categoryId: DIVISION_CATEGORY_IDS.selections?.adult, kidsCategoryId: DIVISION_CATEGORY_IDS.selections?.kids },
  ...buildMaillotSpecialCatalogLeagues(),
];

export function buildCatalogHref(
  kind: CatalogKind,
  audience: CatalogAudience,
  league: CatalogLeague,
  categories: CatalogNavCategories,
  allCategories: readonly {
    id: string;
    name: string;
    parentId?: string | null;
  }[] = [],
): string {
  const adultBase =
    kind === "jersey"
      ? categories.maillotsCategoryId
      : categories.shortsCategoryId;
  const kidsBase =
    kind === "jersey"
      ? categories.kidsMaillotsCategoryId
      : categories.kidsShortsCategoryId;

  const params = new URLSearchParams();
  params.set("kind", kind);
  params.set("league", league.id);
  params.set("audience", audience);

  const division =
    (league.categoryId
      ? getDivisionForCategoryId(league.categoryId, allCategories)
      : null) ?? catalogDivisionFromLeague(league);

  if (audience === "kids") {
    if (league.kidsCategoryId) {
      return `${routes.category(league.kidsCategoryId)}?${params.toString()}`;
    }

    if (allCategories.length > 0 && kidsBase) {
      const kidsDivisionId = findKidsDivisionCategoryId(
        allCategories,
        kidsBase,
        division,
      );
      if (kidsDivisionId) {
        return `${routes.category(kidsDivisionId)}?${params.toString()}`;
      }
    }

    const base = kidsBase ? routes.category(kidsBase) : routes.catalogue;
    return `${base}?${params.toString()}`;
  }

  if (league.categoryId) {
    return `${routes.category(league.categoryId)}?${params.toString()}`;
  }

  if (allCategories.length > 0 && adultBase) {
    const adultDivisionId = findAdultDivisionCategoryId(
      allCategories,
      adultBase,
      division,
    );
    if (adultDivisionId) {
      return `${routes.category(adultDivisionId)}?${params.toString()}`;
    }
  }

  const base = adultBase ? routes.category(adultBase) : routes.catalogue;
  return `${base}?${params.toString()}`;
}
