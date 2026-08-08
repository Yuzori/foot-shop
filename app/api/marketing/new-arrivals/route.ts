import { NextResponse } from "next/server";

import { filterNotifiableProducts } from "@/lib/product-collection";
import { resolveCatalogNavCategories } from "@/lib/resolve-catalog-nav";
import { isSnapshotBootstrapped, readSnapshot } from "@/lib/notify-state";
import { prestashop } from "@/services/prestashop";

/**
 * Produits en file popup + nouveautés non encore notifiées.
 */
export async function GET() {
  if (!prestashop.isConfigured) {
    return NextResponse.json({ items: [] });
  }

  const snapshot = await readSnapshot();
  if (!isSnapshotBootstrapped(snapshot)) {
    return NextResponse.json({ items: [], bootstrapping: true });
  }

  const [result, categories] = await Promise.all([
    prestashop.getProducts({ limit: 500, page: 1, sort: "newest" }),
    prestashop.getCategories(),
  ]);
  const nav = resolveCatalogNavCategories(categories);
  const shortsCategoryIds = new Set(
    [nav.shortsCategoryId, nav.kidsShortsCategoryId].filter(Boolean),
  );
  const notified = new Set(snapshot.notifiedProductIds ?? []);
  const queueIds = new Set(snapshot.popupQueue ?? []);

  const fromQueue = result.items.filter((product) => queueIds.has(product.id));
  const fromSnapshot = result.items.filter(
    (product) => !notified.has(product.id) && !queueIds.has(product.id),
  );

  const merged = new Map<string, (typeof result.items)[number]>();
  for (const product of [...fromQueue, ...fromSnapshot]) {
    merged.set(product.id, product);
  }

  const fresh = filterNotifiableProducts([...merged.values()], shortsCategoryIds);

  return NextResponse.json({
    items: fresh.slice(0, 12),
    total: fresh.length,
  });
}
