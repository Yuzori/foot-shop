import { NextResponse } from "next/server";

import { filterNotifiableProducts } from "@/lib/product-collection";
import { resolveCatalogNavCategories } from "@/lib/resolve-catalog-nav";
import { isSnapshotBootstrapped, readSnapshot } from "@/lib/notify-state";
import { prestashop } from "@/services/prestashop";

/**
 * Produits en file d'attente popup uniquement (pas tout le catalogue non notifié).
 */
export async function GET() {
  if (!prestashop.isConfigured) {
    return NextResponse.json({ items: [] });
  }

  const snapshot = await readSnapshot();
  if (!isSnapshotBootstrapped(snapshot)) {
    return NextResponse.json({ items: [], bootstrapping: true });
  }

  const queueIds = new Set(snapshot.popupQueue ?? []);
  if (queueIds.size === 0) {
    return NextResponse.json({ items: [], total: 0 });
  }

  const [result, categories] = await Promise.all([
    prestashop.getProducts({ limit: 500, page: 1, sort: "newest" }),
    prestashop.getCategories(),
  ]);
  const nav = resolveCatalogNavCategories(categories);
  const shortsCategoryIds = new Set(
    [nav.shortsCategoryId, nav.kidsShortsCategoryId].filter(Boolean),
  );

  const fresh = filterNotifiableProducts(
    result.items.filter((product) => queueIds.has(product.id)),
    shortsCategoryIds,
  );

  return NextResponse.json({
    items: fresh.slice(0, 12),
    total: fresh.length,
  });
}
