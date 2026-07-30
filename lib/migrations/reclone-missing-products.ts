import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { productImportConfig } from "@/config/product-import";
import { buildCategoryAssociationIds } from "@/lib/product-import/category-associations";
import { encodeImageForPrestaShopPreserveOriginal } from "@/lib/product-import/encode-image-for-upload";
import { slugify } from "@/lib/product-import/slug";
import { normalizeCategoryId } from "@/lib/product-import/normalize-category-id";
import { effectiveProductPrice } from "@/lib/product-price";
import { prestashop } from "@/services/prestashop";
import type { Product } from "@/types/domain";

const MANIFEST_PATH = path.join(process.cwd(), ".data", "reclone-manifest.json");

export interface RecloneManifestEntry {
  sourceId: string;
  newId: string;
  name: string;
  clonedAt: string;
}

export interface RecloneManifest {
  version: 1;
  clones: RecloneManifestEntry[];
}

export interface RecloneOptions {
  /** Ne fait que scanner et afficher le plan. */
  dryRun?: boolean;
  /** Nombre max de produits à cloner (0 = illimité). */
  limit?: number;
  /** Pause entre chaque produit (ms). */
  delayMs?: number;
  /** Désactive l’ancien produit après clonage réussi. */
  deactivateSource?: boolean;
}

export interface RecloneScanResult {
  totalProducts: number;
  boListable: number;
  alreadyCloned: number;
  skippedNoPrice: number;
  skippedNoImages: number;
  skippedDuplicateName: number;
  candidates: { id: string; name: string; price: number; imageCount: number }[];
  /** Noms normalisés des produits déjà visibles BO (réutilisé pour le clonage). */
  boNameKeys: string[];
}

export interface RecloneRunResult extends RecloneScanResult {
  cloned: number;
  failed: number;
  errors: { sourceId: string; name: string; error: string }[];
}

function normalizeNameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadManifest(): Promise<RecloneManifest> {
  try {
    const raw = await readFile(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw) as RecloneManifest;
    if (parsed?.version === 1 && Array.isArray(parsed.clones)) return parsed;
  } catch {
    // fresh manifest
  }
  return { version: 1, clones: [] };
}

async function saveManifest(manifest: RecloneManifest): Promise<void> {
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
}

function resolveCategoryId(product: Product): string {
  const fromDefault = normalizeCategoryId(product.defaultCategoryId);
  if (fromDefault && fromDefault !== "0") return fromDefault;
  const fromList = (product.categoryIds ?? [])
    .map((id) => normalizeCategoryId(id))
    .find((id) => id && id !== "0");
  return fromList || productImportConfig.defaultCategoryId;
}

async function cloneOneProduct(
  source: Product,
  boNameKeys: Set<string>,
  options: RecloneOptions,
): Promise<RecloneManifestEntry> {
  const price = effectiveProductPrice(source);
  if (price <= 0) {
    throw new Error("Prix invalide.");
  }

  const nameKey = normalizeNameKey(source.name);
  if (boNameKeys.has(nameKey)) {
    throw new Error("Nom déjà présent dans les produits visibles BO.");
  }

  const categoryId = resolveCategoryId(source);
  if (!categoryId) {
    throw new Error("Catégorie introuvable.");
  }

  const allCategories = await prestashop.getCategories();
  const associationIds = buildCategoryAssociationIds(categoryId, allCategories);
  const linkRewrite = `${slugify(source.name)}-r${source.id}`.slice(0, 120);

  const newId = await prestashop.createProduct({
    name: source.name,
    linkRewrite,
    price,
    categoryId,
    associationIds,
    description: source.description || undefined,
    summary: source.summary?.slice(0, 400) || undefined,
  });

  let uploaded = 0;
  for (const image of source.images) {
    const { buffer, mimeType } = await prestashop.fetchProductImageBuffer(
      source.id,
      image.id,
    );
    const encoded = await encodeImageForPrestaShopPreserveOriginal(buffer, mimeType);
    await prestashop.uploadProductImageFromBuffer(newId, encoded.buffer, encoded.mime);
    uploaded += 1;
  }
  if (uploaded === 0) {
    throw new Error("Aucune image téléversée.");
  }

  const sizeLabels =
    source.variants.length > 0
      ? [
          ...new Set(
            source.variants
              .flatMap((variant) => variant.options.map((opt) => opt.label.trim()))
              .filter(Boolean),
          ),
        ]
      : productImportConfig.sizes;

  const stockPerSize = new Map<string, number>();
  for (const variant of source.variants) {
    const size = variant.options.find((opt) => opt.group.toLowerCase().includes("taille"))
      ?.label;
    if (!size) continue;
    const key = size.trim().toUpperCase();
    const qty = variant.quantity > 0 ? variant.quantity : productImportConfig.defaultStock;
    stockPerSize.set(key, qty);
  }

  const sizeValues = await prestashop.resolveSizeOptionValues(
    sizeLabels.length > 0 ? sizeLabels : productImportConfig.sizes,
    productImportConfig.sizeAttributeGroupId || undefined,
  );

  if (sizeValues.length > 0) {
    for (const size of sizeValues) {
      const combinationId = await prestashop.createProductCombination({
        productId: newId,
        optionValueId: size.id,
      });
      const qty =
        stockPerSize.get(size.label.trim().toUpperCase()) ??
        productImportConfig.defaultStock;
      await prestashop.setStockQuantity(newId, combinationId, qty);
    }
  } else {
    await prestashop.setStockQuantity(newId, null, productImportConfig.defaultStock);
  }

  await prestashop.verifyProductHasStock(newId, productImportConfig.defaultStock);

  if (options.deactivateSource) {
    await prestashop.setProductActive(source.id, false);
  }

  return {
    sourceId: source.id,
    newId,
    name: source.name,
    clonedAt: new Date().toISOString(),
  };
}

/** Scanne le catalogue et liste les produits à re-cloner (hors BO visible). */
export async function scanProductsToReclone(): Promise<RecloneScanResult> {
  if (!prestashop.isConfigured) {
    throw new Error("PrestaShop n'est pas configuré (PRESTASHOP_API_URL / KEY).");
  }

  const manifest = await loadManifest();
  const clonedSourceIds = new Set(manifest.clones.map((entry) => entry.sourceId));

  const all = await prestashop.listAllProductNames({ includeInactive: true });
  const boNameKeys = new Set<string>();
  const candidates: RecloneScanResult["candidates"] = [];

  let boListable = 0;
  let alreadyCloned = 0;
  let skippedNoPrice = 0;
  let skippedNoImages = 0;
  let skippedDuplicateName = 0;

  for (const row of all) {
    const listable = await prestashop.isProductBoListable(row.id);
    if (listable) {
      boListable += 1;
      boNameKeys.add(normalizeNameKey(row.name));
      continue;
    }

    if (clonedSourceIds.has(row.id)) {
      alreadyCloned += 1;
      continue;
    }

    const product = await prestashop.getProductById(row.id);
    if (!product) continue;

    const price = effectiveProductPrice(product);
    if (price <= 0) {
      skippedNoPrice += 1;
      continue;
    }

    if (!product.images.length) {
      skippedNoImages += 1;
      continue;
    }

    const nameKey = normalizeNameKey(product.name);
    if (boNameKeys.has(nameKey)) {
      skippedDuplicateName += 1;
      continue;
    }

    candidates.push({
      id: product.id,
      name: product.name,
      price,
      imageCount: product.images.length,
    });
  }

  return {
    totalProducts: all.length,
    boListable,
    alreadyCloned,
    skippedNoPrice,
    skippedNoImages,
    skippedDuplicateName,
    candidates,
    boNameKeys: [...boNameKeys],
  };
}

export interface RecloneRunOptions extends RecloneOptions {
  /** Scan déjà effectué — évite un second passage sur tout le catalogue. */
  scan?: RecloneScanResult;
}

/**
 * Re-clone les produits actifs avec prix/images qui ne sont pas visibles dans le BO.
 * Les ~207 déjà listables sont ignorés. Ne supprime rien par défaut.
 */
export async function recloneMissingProducts(
  options: RecloneRunOptions = {},
): Promise<RecloneRunResult> {
  const scan = options.scan ?? (await scanProductsToReclone());
  const limit = options.limit && options.limit > 0 ? options.limit : scan.candidates.length;
  const targets = scan.candidates.slice(0, limit);

  if (options.dryRun) {
    return { ...scan, cloned: 0, failed: 0, errors: [] };
  }

  const manifest = await loadManifest();
  const boNameKeys = new Set(scan.boNameKeys);

  let cloned = 0;
  let failed = 0;
  const errors: RecloneRunResult["errors"] = [];

  for (const target of targets) {
    try {
      const product = await prestashop.getProductById(target.id);
      if (!product) {
        throw new Error("Produit source introuvable.");
      }

      const entry = await cloneOneProduct(product, boNameKeys, options);
      manifest.clones.push(entry);
      await saveManifest(manifest);
      boNameKeys.add(normalizeNameKey(entry.name));
      cloned += 1;
      console.info(
        `[reclone] OK source=#${entry.sourceId} → new=#${entry.newId} "${entry.name}"`,
      );
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ sourceId: target.id, name: target.name, error: message });
      console.error(`[reclone] FAIL source=#${target.id} "${target.name}" — ${message}`);
    }

    if (options.delayMs && options.delayMs > 0) {
      await sleep(options.delayMs);
    }
  }

  return { ...scan, cloned, failed, errors };
}
