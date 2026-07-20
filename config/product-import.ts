import { catalogConfig } from "@/config/catalog";
import { worldCupConfig } from "@/config/world-cup";
import { shopConfig } from "@/config/shop";

/**
 * Import produit depuis une URL — configuration.
 *
 * PRESTASHOP_SIZE_GROUP_ID : ID du groupe d'attributs « Taille » dans PrestaShop.
 * PRODUCT_IMPORT_CATEGORY_ID : catégorie par défaut (sinon maillots).
 */
export const productImportConfig = {
  defaultStock: 20,
  defaultPrice: Number(process.env.PRODUCT_IMPORT_DEFAULT_PRICE ?? "25.99") || 25.99,
  defaultCategoryId:
    process.env.PRODUCT_IMPORT_CATEGORY_ID?.trim() ||
    worldCupConfig.categoryId ||
    catalogConfig.maillots.categoryId ||
    "",
  /** Catégorie parente pour les nouvelles collections (souvent « Accueil » = 2). */
  parentCategoryId:
    process.env.PRODUCT_IMPORT_PARENT_CATEGORY_ID?.trim() || "2",
  sizeAttributeGroupId: process.env.PRESTASHOP_SIZE_GROUP_ID?.trim() ?? "",
  sizes: shopConfig.sizeOrder,
  maxImages: 24,
  fetchTimeoutMs: 15_000,
  maxHtmlBytes: 2 * 1024 * 1024,
  /** Limite douce d'URLs par session d'import (côté client). */
  maxUrlsPerImport: Number(process.env.PRODUCT_IMPORT_MAX_URLS ?? "200") || 200,
} as const;
