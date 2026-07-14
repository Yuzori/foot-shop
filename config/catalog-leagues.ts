import { routes } from "@/config/site";
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

export const catalogLeagues: CatalogLeague[] = [
  {
    id: "world-cup",
    label: "World Cup",
    icon: "/leagues/world-cup.png",
    categoryId: worldCupConfig.categoryId,
  },
  { id: "ligue-1", label: "Ligue 1", icon: "/leagues/ligue1.png" },
  {
    id: "premier-league",
    label: "Premier League",
    icon: "/leagues/premier-league.png",
  },
  { id: "la-liga", label: "La Liga", icon: "/leagues/la-liga.png" },
  { id: "serie-a", label: "Serie A", icon: "/leagues/serie-a.png" },
  { id: "bundesliga", label: "Bundesliga", icon: "/leagues/bundesliga.png" },
  {
    id: "ligue-des-champions",
    label: "Ligue des champions",
    icon: "/leagues/champions-league.png",
  },
  { id: "selections", label: "Sélections", icon: "/leagues/selections.png" },
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
