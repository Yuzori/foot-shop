import type { Product, SortOption } from "@/types/domain";

const NEWEST_FIRST: SortOption = "newest";

/** Tri côté app — par défaut : du plus récent au plus ancien. */
export function sortProducts(items: Product[], sort?: SortOption): Product[] {
  const effectiveSort =
    !sort || sort === "relevance" ? NEWEST_FIRST : sort;

  const copy = [...items];
  switch (effectiveSort) {
    case "newest":
      return copy.sort((a, b) => {
        const da = a.createdAt ? Date.parse(a.createdAt) : 0;
        const db = b.createdAt ? Date.parse(b.createdAt) : 0;
        if (db !== da) return db - da;
        return Number(b.id) - Number(a.id);
      });
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
