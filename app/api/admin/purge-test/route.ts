import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import { purgeTestOrderArchives } from "@/lib/order-archive-store";
import { purgeTestShippingEntries } from "@/lib/order-shipping-store";
import { purgeTestSupplierDrafts } from "@/lib/supplier-order-store";

/** Supprime commandes, expéditions et brouillons BBDBuy de test. */
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  const [archives, shipping, supplier] = await Promise.all([
    purgeTestOrderArchives(),
    purgeTestShippingEntries(),
    purgeTestSupplierDrafts(),
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
