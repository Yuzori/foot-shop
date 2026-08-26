import "server-only";

import { buildAdminCategoryOptGroups } from "@/lib/admin/import-category-tree";
import type { ProductAudience } from "@/lib/product-import/format-product-name";
import {
  detectProductCollectionKind,
} from "@/lib/product-import/format-product-name";
import type { ProductCollectionKind } from "@/lib/product-collection";
import { STUDIO_MAX_IMAGES } from "@/lib/jersey-studio/constants";
import { scrapeProductPage } from "@/lib/product-import/scraper";
import { suggestImportCategory } from "@/lib/product-import/suggest-import-category";
import { prestashop } from "@/services/prestashop";

const MAX_IMAGES_PER_PRODUCT = STUDIO_MAX_IMAGES;

export interface ScrapedStudioProduct {
  sourceUrl: string;
  name: string;
  audience: ProductAudience;
  collectionKind: ProductCollectionKind;
  description: string;
  imageUrls: string[];
  suggestedCategoryId?: string;
  suggestedCategoryLabel?: string;
  suggestedCategoryReason?: string;
  error?: string;
}

export async function scrapeStudioProducts(
  urls: string[],
): Promise<ScrapedStudioProduct[]> {
  const categories = await prestashop.getCategories();
  const categoryOptGroups = buildAdminCategoryOptGroups(categories);
  const results: ScrapedStudioProduct[] = [];

  for (const sourceUrl of urls) {
    try {
      const scraped = await scrapeProductPage(sourceUrl, {
        maxImages: MAX_IMAGES_PER_PRODUCT,
      });

      const kind = detectProductCollectionKind(scraped.rawTitle);
      const suggestion = suggestImportCategory({
        title: scraped.rawTitle,
        sourceUrl: scraped.sourceUrl,
        audience: scraped.audience,
        kind,
        categories,
        optGroups: categoryOptGroups,
      });

      results.push({
        sourceUrl: scraped.sourceUrl,
        name: scraped.name,
        audience: scraped.audience,
        collectionKind: kind,
        description: scraped.description,
        imageUrls: scraped.images.slice(0, MAX_IMAGES_PER_PRODUCT),
        suggestedCategoryId: suggestion?.categoryId != null
          ? String(suggestion.categoryId)
          : undefined,
        suggestedCategoryLabel: suggestion?.label,
        suggestedCategoryReason: suggestion?.reason,
      });
    } catch (err) {
      results.push({
        sourceUrl,
        name: sourceUrl.split("/").filter(Boolean).pop() ?? "Produit",
        audience: "adult",
        collectionKind: "jersey",
        description: "",
        imageUrls: [],
        error: err instanceof Error ? err.message : "scrape_failed",
      });
    }
  }

  return results;
}
