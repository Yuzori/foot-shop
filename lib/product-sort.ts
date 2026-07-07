import type { Product, SortOption } from "@/types/domain";

/** Tri côté app : certaines configs PrestaShop refusent date_add/price en API. */
export function sortProducts(items: Product[], sort?: SortOption): Product[] {
  if (!sort || sort === "relevance") return items;

  const copy = [...items];
  switch (sort) {
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
