import "server-only";

import { productImportConfig } from "@/config/product-import";
import { slugify } from "@/lib/product-import/slug";
import {
  detectAudience,
  detectProductCollectionKind,
} from "@/lib/product-import/format-product-name";
import { resolveImportCategoryForProduct } from "@/lib/product-import/resolve-import-category";
import {
  resolveCategoryForImport,
  type CategoryImportInput,
} from "@/lib/product-import/resolve-category";
import { scrapeProductPage, type ScrapedProduct } from "@/lib/product-import/scraper";
import { prestashop } from "@/services/prestashop";

export interface ImportProductInput {
  sourceUrl: string;
  name?: string;
  price?: number;
  categoryId?: string;
  stock?: number;
  sizes?: readonly string[];
}

export type { CategoryImportInput };

export interface ImportProductResult {
  productId: string;
  name: string;
  combinations: { size: string; combinationId: string }[];
  imagesUploaded: number;
  scraped: ScrapedProduct;
}

/** Scrape + création produit PrestaShop + déclinaisons + stock. */
export async function runProductImport(
  input: ImportProductInput,
): Promise<ImportProductResult> {
  if (!prestashop.isConfigured) {
    throw new Error("PrestaShop n'est pas configuré.");
  }

  const scraped = await scrapeProductPage(input.sourceUrl);
  const name = (input.name?.trim() || scraped.name).slice(0, 250);
  const price = input.price ?? productImportConfig.defaultPrice;
  const audience = scraped.audience ?? detectAudience(name);
  const collectionKind = detectProductCollectionKind(name);
  const fallbackCategoryId = input.categoryId ?? productImportConfig.defaultCategoryId;
  if (!fallbackCategoryId) {
    throw new Error(
      "Aucune catégorie de destination. Sélectionnez World Cup ou définissez PRODUCT_IMPORT_CATEGORY_ID.",
    );
  }
  const categoryId =
    audience === "kids"
      ? await resolveImportCategoryForProduct(
          collectionKind,
          audience,
          fallbackCategoryId,
        )
      : fallbackCategoryId;
  const stock = input.stock ?? productImportConfig.defaultStock;
  const sizes = input.sizes ?? productImportConfig.sizes;

  const productId = await prestashop.createProduct({
    name,
    linkRewrite: slugify(name),
    price,
    categoryId,
  });

  let imagesUploaded = 0;
  for (let i = 0; i < scraped.images.length; i++) {
    const imageUrl = scraped.images[i]!;
    let uploaded = false;
    for (let attempt = 0; attempt < 3 && !uploaded; attempt++) {
      try {
        await prestashop.uploadProductImageFromUrl(
          productId,
          imageUrl,
          scraped.sourceUrl,
        );
        imagesUploaded += 1;
        uploaded = true;
      } catch (err) {
        if (attempt === 2) {
          console.warn(`[import] image failed product=${productId} url=${imageUrl}`, err);
        } else {
          await sleep(500 * (attempt + 1));
        }
      }
    }
    if (i < scraped.images.length - 1) await sleep(350);
  }

  const sizeValues = await prestashop.resolveSizeOptionValues(
    sizes,
    productImportConfig.sizeAttributeGroupId || undefined,
  );

  const combinations: { size: string; combinationId: string }[] = [];

  try {
    if (sizeValues.length > 0) {
      for (const size of sizeValues) {
        const combinationId = await prestashop.createProductCombination({
          productId,
          optionValueId: size.id,
        });
        await prestashop.setStockQuantity(productId, combinationId, stock);
        combinations.push({ size: size.label, combinationId });
      }
    } else {
      await prestashop.setStockQuantity(productId, null, stock);
    }
  } catch (err) {
    console.warn(
      `[import] tailles/stock ignorés pour product=${productId}`,
      err instanceof Error ? err.message : err,
    );
  }

  return {
    productId,
    name,
    combinations,
    imagesUploaded,
    scraped: { ...scraped, name },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface BulkImportItemResult {
  sourceUrl: string;
  ok: boolean;
  productId?: string;
  name?: string;
  imagesUploaded?: number;
  error?: string;
}

/** Importe plusieurs URLs, un produit par lien. */
export async function runBulkProductImport(
  urls: readonly string[],
  options?: Omit<ImportProductInput, "sourceUrl" | "name"> & {
    category?: CategoryImportInput;
  },
): Promise<{
  results: BulkImportItemResult[];
  category: { id: string; name: string; created: boolean };
}> {
  const category = await resolveCategoryForImport(
    options?.category ?? {
      mode: "existing",
      categoryId: options?.categoryId ?? productImportConfig.defaultCategoryId,
    },
  );

  const results: BulkImportItemResult[] = [];

  for (let i = 0; i < urls.length; i++) {
    const sourceUrl = urls[i]!;
    try {
      const result = await runProductImport({
        sourceUrl,
        price: options?.price,
        categoryId: category.id,
        stock: options?.stock,
        sizes: options?.sizes,
      });
      results.push({
        sourceUrl,
        ok: true,
        productId: result.productId,
        name: result.name,
        imagesUploaded: result.imagesUploaded,
      });
    } catch (err) {
      results.push({
        sourceUrl,
        ok: false,
        error: err instanceof Error ? err.message : "import_failed",
      });
    }

    if (i < urls.length - 1) await sleep(600);
  }

  return { results, category };
}
