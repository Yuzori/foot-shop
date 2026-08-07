import { NextResponse } from "next/server";

import { filterProductsByKind } from "@/lib/product-collection";
import { isSnapshotBootstrapped, readSnapshot } from "@/lib/notify-state";
import { prestashop } from "@/services/prestashop";

/**
 * Maillots en file d'attente popup + nouveautés non encore dans le snapshot.
 */
export async function GET() {
  if (!prestashop.isConfigured) {
    return NextResponse.json({ items: [] });
  }

  const snapshot = await readSnapshot();
  if (!isSnapshotBootstrapped(snapshot)) {
    return NextResponse.json({ items: [], bootstrapping: true });
  }

  const result = await prestashop.getProducts({ limit: 500, page: 1, sort: "newest" });
  const queueIds = new Set(snapshot.popupQueue ?? []);
  const fromQueue = result.items.filter((product) => queueIds.has(product.id));
  const fromSnapshot = filterProductsByKind(
    result.items.filter((product) => !snapshot.items[product.id]),
    "jersey",
  );

  const merged = new Map<string, (typeof result.items)[number]>();
  for (const product of [...fromQueue, ...fromSnapshot]) {
    merged.set(product.id, product);
  }

  const fresh = filterProductsByKind([...merged.values()], "jersey");

  return NextResponse.json({
    items: fresh.slice(0, 12),
    total: fresh.length,
  });
}
