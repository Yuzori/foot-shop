import "server-only";

import { productImportConfig } from "@/config/product-import";
import { slugify } from "@/lib/product-import/slug";
import { prestashop } from "@/services/prestashop";

export type CategoryImportMode = "existing" | "new";

export interface CategoryImportInput {
  mode: CategoryImportMode;
  categoryId?: string;
  newCategoryName?: string;
  newCategoryImageBase64?: string;
  newCategoryImageMime?: string;
}

export interface ResolvedCategory {
  id: string;
  name: string;
  created: boolean;
}

const MAX_CATEGORY_IMAGE_BYTES = 3 * 1024 * 1024;

/** Résout la catégorie cible (existante ou nouvelle avec image). */
export async function resolveCategoryForImport(
  input: CategoryImportInput,
): Promise<ResolvedCategory> {
  if (!prestashop.isConfigured) {
    throw new Error("PrestaShop n'est pas configuré.");
  }

  if (input.mode === "existing") {
    const id = input.categoryId?.trim();
    if (!id) throw new Error("Sélectionnez une catégorie existante.");

    const category = await prestashop.getCategoryById(id);
    if (!category) throw new Error("Catégorie introuvable.");

    return { id, name: category.name, created: false };
  }

  const name = input.newCategoryName?.trim();
  if (!name || name.length < 2) {
    throw new Error("Le nom de la nouvelle catégorie est requis.");
  }

  const categoryId = await prestashop.createCategory({
    name: name.slice(0, 128),
    linkRewrite: slugify(name),
    parentId: productImportConfig.parentCategoryId,
  });

  if (input.newCategoryImageBase64) {
    const buffer = Buffer.from(input.newCategoryImageBase64, "base64");
    if (buffer.byteLength > MAX_CATEGORY_IMAGE_BYTES) {
      throw new Error("Image de catégorie trop volumineuse (max 3 Mo).");
    }
    if (buffer.byteLength < 1_000) {
      throw new Error("Image de catégorie invalide.");
    }

    const mime = input.newCategoryImageMime?.trim() || "image/jpeg";
    if (!/^image\/(jpe?g|png|webp)$/i.test(mime)) {
      throw new Error("Format d'image non supporté (JPEG, PNG ou WebP).");
    }

    await prestashop.uploadCategoryImageBuffer(categoryId, buffer, mime);
  }

  return { id: categoryId, name: name.slice(0, 128), created: true };
}
