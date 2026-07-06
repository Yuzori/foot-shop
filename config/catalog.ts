import { routes } from "@/config/site";

/**
 * Collections principales — renseignez les IDs PrestaShop si besoin.
 * Sinon, le hook useCatalogNav les détecte par nom (maillot / short).
 */
export const catalogConfig = {
  maillots: {
    label: "Maillots",
    categoryId: process.env.NEXT_PUBLIC_MAILLOTS_CATEGORY_ID?.trim() ?? "",
  },
  shorts: {
    label: "Shorts",
    categoryId: process.env.NEXT_PUBLIC_SHORTS_CATEGORY_ID?.trim() ?? "",
  },
  kidsMaillots: {
    label: "Maillot - Enfant",
    categoryId:
      process.env.NEXT_PUBLIC_ENFANT_MAILLOTS_CATEGORY_ID?.trim() ??
      process.env.NEXT_PUBLIC_KIDS_MAILLOTS_CATEGORY_ID?.trim() ??
      "",
  },
  kidsShorts: {
    label: "Enfant - Short",
    categoryId:
      process.env.NEXT_PUBLIC_ENFANT_SHORTS_CATEGORY_ID?.trim() ??
      process.env.NEXT_PUBLIC_KIDS_SHORTS_CATEGORY_ID?.trim() ??
      "",
  },
} as const;

export function categoryHref(categoryId: string, fallback = routes.catalogue): string {
  return categoryId ? routes.category(categoryId) : fallback;
}
