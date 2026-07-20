import "server-only";

import { detectAudience } from "@/lib/product-import/format-product-name";
import {
  getKitSiblingKey,
  buildKitSearchQueries,
  resolveKitTypeFromName,
  detectKitTypeFromName,
  KIT_TYPE_ORDER,
  type KitType,
  KIT_TYPE_LABELS,
} from "@/lib/kit-type";
import { isJerseyProduct } from "@/lib/product-collection";
import { prestashop } from "@/services/prestashop";
import type { Product } from "@/types/domain";

export type KitSiblingOption = {
  id: string;
  name: string;
  kitType: KitType;
  label: string;
  imageUrl: string | null;
};

function collectCandidates(
  target: Map<string, Product>,
  products: Product[],
): void {
  for (const item of products) {
    if (!target.has(item.id)) target.set(item.id, item);
  }
}

/** Autres maillots de la même équipe / saison (domicile, extérieur, third) — matching par nom. */
export async function findKitSiblings(product: {
  id: string;
  name: string;
  defaultCategoryId?: string | null;
  coverUrl?: string | null;
}): Promise<KitSiblingOption[]> {
  if (!isJerseyProduct(product.name)) return [];

  const siblingKey = getKitSiblingKey(product.name);
  if (!siblingKey) return [];

  const currentKit = resolveKitTypeFromName(product.name);
  const audience = detectAudience(product.name);
  const queries = buildKitSearchQueries(product.name);

  const candidates = new Map<string, Product>();

  if (product.defaultCategoryId) {
    const fromCategory = await prestashop.getCategoryProducts(
      product.defaultCategoryId,
      120,
    );
    collectCandidates(candidates, fromCategory);
  }

  for (const query of queries) {
    const { items } = await prestashop.getProducts({
      search: query,
      limit: 80,
      page: 1,
    });
    collectCandidates(candidates, items);
  }

  const byType = new Map<KitType, KitSiblingOption>();

  for (const candidate of candidates.values()) {
    if (candidate.id === product.id) continue;
    if (!isJerseyProduct(candidate.name)) continue;
    if (detectAudience(candidate.name) !== audience) continue;
    if (getKitSiblingKey(candidate.name) !== siblingKey) continue;

    const kitType = detectKitTypeFromName(candidate.name);
    if (!kitType) continue;

    if (!byType.has(kitType)) {
      byType.set(kitType, {
        id: candidate.id,
        name: candidate.name,
        kitType,
        label: KIT_TYPE_LABELS[kitType],
        imageUrl: candidate.cover?.url ?? candidate.images[0]?.url ?? null,
      });
    }
  }

  const currentOption: KitSiblingOption = {
    id: product.id,
    name: product.name,
    kitType: currentKit,
    label: KIT_TYPE_LABELS[currentKit],
    imageUrl: product.coverUrl ?? null,
  };

  const options = KIT_TYPE_ORDER.map((type) => {
    if (type === currentKit) return currentOption;
    return byType.get(type);
  }).filter((option): option is KitSiblingOption => Boolean(option));

  return options.length > 1 ? options : [];
}
