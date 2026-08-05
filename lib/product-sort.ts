import {
  parseSeasonFromText,
  type ParsedSeason,
} from "@/lib/product-import/format-product-name";
import type { Product, SortOption } from "@/types/domain";

const NEWEST_FIRST: SortOption = "newest";

/** Score de tri — plus élevé = saison plus récente (ex. 26-27 > 25-26). */
function seasonSortScore(season: ParsedSeason): number {
  if (season.kind === "range") {
    return season.end * 100 + (season.start % 100);
  }
  return season.year * 100;
}

function seasonScoreFromName(name: string): number | null {
  const parsed = parseSeasonFromText(name);
  return parsed ? seasonSortScore(parsed) : null;
}

function compareNewestProducts(a: Product, b: Product): number {
  const seasonA = seasonScoreFromName(a.name);
  const seasonB = seasonScoreFromName(b.name);

  if (seasonA != null && seasonB != null && seasonB !== seasonA) {
    return seasonB - seasonA;
  }
  if (seasonA != null && seasonB == null) return -1;
  if (seasonA == null && seasonB != null) return 1;

  const da = a.createdAt ? Date.parse(a.createdAt) : 0;
  const db = b.createdAt ? Date.parse(b.createdAt) : 0;
  if (db !== da) return db - da;

  const byName = a.name.localeCompare(b.name, "fr");
  if (byName !== 0) return byName;

  return Number(b.id) - Number(a.id);
}

/** Tri côté app — par défaut : saison la plus récente (26-27, 26/27…) puis alphabétique. */
export function sortProducts(items: Product[], sort?: SortOption): Product[] {
  const effectiveSort =
    !sort || sort === "relevance" ? NEWEST_FIRST : sort;

  const copy = [...items];
  switch (effectiveSort) {
    case "newest":
      return copy.sort(compareNewestProducts);
    case "price-asc":
      return copy.sort((a, b) => a.price - b.price);
    case "price-desc":
      return copy.sort((a, b) => b.price - a.price);
    case "name-asc":
      return copy.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    default:
      return copy;
  }
}
