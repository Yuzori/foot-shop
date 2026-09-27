import { routes } from "@/config/site";

/**
 * Collections principales - renseignez les IDs PrestaShop si besoin.
 * Sinon, le hook useCatalogNav les détecte par nom (maillot / short / veste).
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
  jackets: {
    label: "Vestes",
    categoryId:
      process.env.NEXT_PUBLIC_VESTES_CATEGORY_ID?.trim() ??
      process.env.NEXT_PUBLIC_JACKETS_CATEGORY_ID?.trim() ??
      "",
  },
  kidsMaillots: {
    label: "Maillot enfant",
    categoryId:
      process.env.NEXT_PUBLIC_ENFANT_MAILLOTS_CATEGORY_ID?.trim() ??
      process.env.NEXT_PUBLIC_KIDS_MAILLOTS_CATEGORY_ID?.trim() ??
      "",
  },
  kidsShorts: {
    label: "Enfant short",
    categoryId:
      process.env.NEXT_PUBLIC_ENFANT_SHORTS_CATEGORY_ID?.trim() ??
      process.env.NEXT_PUBLIC_KIDS_SHORTS_CATEGORY_ID?.trim() ??
      "",
  },
  kidsJackets: {
    label: "Enfant veste",
    categoryId:
      process.env.NEXT_PUBLIC_ENFANT_VESTES_CATEGORY_ID?.trim() ??
      process.env.NEXT_PUBLIC_KIDS_JACKETS_CATEGORY_ID?.trim() ??
      "",
  },
} as const;

export function categoryHref(categoryId: string, fallback = routes.catalogue): string {
  return categoryId ? routes.category(categoryId) : fallback;
}
