import { NextResponse } from "next/server";

import { ensureAdminDataReset } from "@/lib/admin-data-wipe";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { purgeAllOrderArchives } from "@/lib/order-archive-store";
import { purgeAllShippingEntries } from "@/lib/order-shipping-store";
import { purgeAllSupplierDrafts } from "@/lib/supplier-order-store";

/** Supprime toutes les données admin (historique, expéditions, brouillons). */
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  const [archives, shipping, supplier] = await Promise.all([
    purgeAllOrderArchives(),
    purgeAllShippingEntries(),
    purgeAllSupplierDrafts(),
  ]);

  return NextResponse.json({
    ok: true,
    removed: {
      archives: archives.removed,
      shipping: shipping.removed,
      supplier: supplier.removed,
    },
  });
}
