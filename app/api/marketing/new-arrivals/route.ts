import { NextResponse } from "next/server";

import { filterProductsByKind } from "@/lib/product-collection";
import { isSnapshotBootstrapped, readSnapshot } from "@/lib/notify-state";
import { prestashop } from "@/services/prestashop";

/**
 * Maillots publiés dans PrestaShop mais absents du snapshot serveur
 * (= vraies nouveautés, pas un artefact de redéploiement).
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
  const fresh = filterProductsByKind(
    result.items.filter((product) => !snapshot.items[product.id]),
    "jersey",
  );

  return NextResponse.json({
    items: fresh.slice(0, 12),
    total: fresh.length,
  });
}
