import "server-only";

import { productImportConfig } from "@/config/product-import";
import { slugify } from "@/lib/product-import/slug";
import {
  detectAudience,
  detectProductCollectionKind,
} from "@/lib/product-import/format-product-name";
import { buildCategoryAssociationIds } from "@/lib/product-import/category-associations";
import { resolveImportCategoryForProduct } from "@/lib/product-import/resolve-import-category";
import { normalizeCategoryId } from "@/lib/product-import/normalize-category-id";
import { encodeImageForPrestaShopPreserveOriginal } from "@/lib/product-import/encode-image-for-upload";
import { fetchImageBuffer } from "@/lib/jersey-studio/fetch-image";
import { prestashop } from "@/services/prestashop";

const QUICK_PRICE = 24.99;
const QUICK_STOCK = 20;

export interface QuickImportInput {
  name: string;
  imageUrls: string[];
  sourceUrl?: string;
  categoryId?: string;
  price?: number;
  stock?: number;
  description?: string;
}

export interface QuickImportResult {
  productId: string;
  name: string;
  imagesUploaded: number;
}

/** Crée un produit PrestaShop avec les images scrappées (sans rendu ni détourage). */
export async function runQuickProductImport(
  input: QuickImportInput,
): Promise<QuickImportResult> {
  if (!prestashop.isConfigured) {
    throw new Error("PrestaShop n'est pas configuré.");
  }

  const name = input.name.trim().slice(0, 250);
  if (!name) throw new Error("Nom produit requis.");

  const urls = input.imageUrls.map((u) => u.trim()).filter(Boolean);
  if (!urls.length) throw new Error("Aucune image à envoyer.");

  const referer = input.sourceUrl?.trim();
  const fetched: { buffer: Buffer; mimeType: string }[] = [];

  for (const imageUrl of urls) {
    const { buffer, mimeType } = await fetchImageBuffer(imageUrl, referer);
    if (buffer.byteLength < 2_500) {
      throw new Error(`Image trop petite : ${imageUrl}`);
    }
    fetched.push({ buffer, mimeType });
  }

  const price = input.price ?? QUICK_PRICE;
  const stock = input.stock ?? QUICK_STOCK;
  const fallbackCategoryId =
    normalizeCategoryId(input.categoryId) || productImportConfig.defaultCategoryId;
  if (!fallbackCategoryId) {
    throw new Error("Aucune catégorie de destination configurée.");
  }

  const audience = detectAudience(name);
  const collectionKind = detectProductCollectionKind(name);
  const categoryId =
    audience === "kids"
      ? await resolveImportCategoryForProduct(
          collectionKind,
          audience,
          fallbackCategoryId,
          name,
        )
      : fallbackCategoryId;

  const allCategories = await prestashop.getCategories();
  const categoryAssociationIds = buildCategoryAssociationIds(
    categoryId,
    allCategories,
  );

  const productId = await prestashop.createProduct({
    name,
    linkRewrite: slugify(name),
    price,
    categoryId,
    associationIds: categoryAssociationIds,
    description: input.description?.trim() || undefined,
    summary: input.description?.trim().slice(0, 400) || undefined,
  });

  let uploaded = 0;
  for (const image of fetched) {
    const encoded = await encodeImageForPrestaShopPreserveOriginal(
      image.buffer,
      image.mimeType,
    );
    await prestashop.uploadProductImageFromBuffer(
      productId,
      encoded.buffer,
      encoded.mime,
    );
    uploaded++;
  }

  const sizeValues = await prestashop.resolveSizeOptionValues(
    productImportConfig.sizes,
    productImportConfig.sizeAttributeGroupId || undefined,
  );

  try {
    if (sizeValues.length > 0) {
      for (const size of sizeValues) {
        const combinationId = await prestashop.createProductCombination({
          productId,
          optionValueId: size.id,
        });
        await prestashop.setStockQuantity(productId, combinationId, stock);
      }
    } else {
      await prestashop.setStockQuantity(productId, null, stock);
    }
  } catch (err) {
    console.warn(
      `[quick-import] tailles/stock ignorés pour product=${productId}`,
      err instanceof Error ? err.message : err,
    );
  }

  return { productId, name, imagesUploaded: uploaded };
}
