import "server-only";

import { productImportConfig } from "@/config/product-import";
import { slugify } from "@/lib/product-import/slug";
import {
  detectAudience,
  detectProductCollectionKind,
} from "@/lib/product-import/format-product-name";
import { encodeImageForPrestaShop } from "@/lib/product-import/encode-image-for-upload";
import { resolveImportCategoryForProduct } from "@/lib/product-import/resolve-import-category";
import { scrapeProductPage } from "@/lib/product-import/scraper";
import { prestashop } from "@/services/prestashop";

const FIGMA_PRICE = 24.99;
const FIGMA_STOCK = 20;

const BACK_SIDE_URL =
  /back|dos|verso|rear|_b\b|_back|vue[_-]?2|side|profil|lateral|_s\b|_side|vue[_-]?3/i;

function pickFrontImageUrl(images: string[]): string | undefined {
  const front = images.find((url) => !BACK_SIDE_URL.test(url.toLowerCase()));
  return front ?? images[0];
}

export interface FigmaImportInput {
  name: string;
  imageBase64: string;
  /** Images supplémentaires (galerie PrestaShop). */
  imagesBase64?: string[];
  imageMime?: string;
  sourceUrl?: string;
  categoryId?: string;
  price?: number;
  stock?: number;
  description?: string;
  /** Studio admin : utilise exactement la catégorie choisie (pas de reroutage enfant auto). */
  useExactCategory?: boolean;
}

export interface FigmaImportResult {
  productId: string;
  name: string;
  combinations: { size: string; combinationId: string }[];
  imagesUploaded: number;
}

/** Crée un produit PrestaShop avec l'image traitée depuis Figma (une seule image). */
export async function runFigmaProductImport(
  input: FigmaImportInput,
): Promise<FigmaImportResult> {
  if (!prestashop.isConfigured) {
    throw new Error("PrestaShop n'est pas configuré.");
  }

  const name = input.name.trim().slice(0, 250);
  if (!name) throw new Error("Nom produit requis.");

  const rawBuffer = Buffer.from(input.imageBase64, "base64");
  if (rawBuffer.byteLength < 8_000) {
    throw new Error("Image exportée trop petite.");
  }
  if (rawBuffer.byteLength > 12 * 1024 * 1024) {
    throw new Error("Image exportée trop volumineuse (max 12 Mo).");
  }

  const { buffer, mime: uploadMime } = await encodeImageForPrestaShop(rawBuffer);

  const price = input.price ?? FIGMA_PRICE;
  const stock = input.stock ?? FIGMA_STOCK;
  const audience = detectAudience(name);
  const collectionKind = detectProductCollectionKind(name);
  const fallbackCategoryId = input.categoryId ?? productImportConfig.defaultCategoryId;
  if (!fallbackCategoryId) {
    throw new Error("Aucune catégorie de destination configurée.");
  }

  const categoryId = input.useExactCategory
    ? fallbackCategoryId
    : audience === "kids"
      ? await resolveImportCategoryForProduct(collectionKind, audience, fallbackCategoryId)
      : fallbackCategoryId;

  const productId = await prestashop.createProduct({
    name,
    linkRewrite: slugify(name),
    price,
    categoryId,
    description: input.description?.trim() || undefined,
    summary: input.description?.trim().slice(0, 400) || undefined,
  });

  await prestashop.uploadProductImageFromBuffer(productId, buffer, uploadMime);

  const extraImages = input.imagesBase64 ?? [];
  for (const extra of extraImages) {
    const extraRaw = Buffer.from(extra, "base64");
    if (extraRaw.byteLength < 8_000) continue;
    if (extraRaw.byteLength > 12 * 1024 * 1024) continue;
    const encoded = await encodeImageForPrestaShop(extraRaw);
    await prestashop.uploadProductImageFromBuffer(productId, encoded.buffer, encoded.mime);
  }

  const sizeValues = await prestashop.resolveSizeOptionValues(
    productImportConfig.sizes,
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
      `[figma-import] tailles/stock ignorés pour product=${productId}`,
      err instanceof Error ? err.message : err,
    );
  }

  const uploadedCount = 1 + (input.imagesBase64?.length ?? 0);

  return {
    productId,
    name,
    combinations,
    imagesUploaded: uploadedCount,
  };
}

async function fetchProductImageBytes(
  imageUrl: string,
  referer?: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const { validateSourceUrl } = await import("@/lib/product-import/validate-url");
  const url = await validateSourceUrl(imageUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        ...(referer ? { Referer: referer } : {}),
      },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`Image inaccessible (${response.status}).`);
  }

  const mimeType = (response.headers.get("content-type") ?? "image/jpeg")
    .split(";")[0]
    ?.trim() || "image/jpeg";
  if (!mimeType.startsWith("image/")) {
    throw new Error("L'URL ne pointe pas vers une image.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 8_000) {
    throw new Error("Image trop petite (probablement une miniature).");
  }
  if (buffer.byteLength > 8 * 1024 * 1024) {
    throw new Error("Image trop volumineuse (max 8 Mo).");
  }

  return { buffer, mimeType };
}

export async function previewProductFromUrl(sourceUrl: string) {
  const scraped = await scrapeProductPage(sourceUrl);
  const imageUrl = pickFrontImageUrl(scraped.images);
  if (!imageUrl) {
    throw new Error("Aucune image maillot de face trouvée sur cette page.");
  }

  return {
    name: scraped.name,
    sourceUrl: scraped.sourceUrl,
    imageUrl,
    audience: scraped.audience,
  };
}

export async function fetchProductImageForFigma(imageUrl: string, referer?: string) {
  const { buffer, mimeType } = await fetchProductImageBytes(imageUrl, referer);
  return {
    mimeType,
    imageBase64: buffer.toString("base64"),
  };
}

/** Scrape page + image pour le plugin Figma (évite les fetch fournisseurs côté Figma). */
export async function scrapeProductImageForFigma(sourceUrl: string) {
  const scraped = await scrapeProductPage(sourceUrl);
  const imageUrl = pickFrontImageUrl(scraped.images);
  if (!imageUrl) {
    throw new Error("Aucune image maillot de face trouvée sur cette page.");
  }

  const { buffer, mimeType } = await fetchProductImageBytes(
    imageUrl,
    scraped.sourceUrl,
  );

  return {
    name: scraped.name,
    sourceUrl: scraped.sourceUrl,
    mimeType,
    imageBase64: buffer.toString("base64"),
  };
}
