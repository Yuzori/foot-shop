import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import { repairPrestaShopOrderStates } from "@/lib/repair-prestashop-orders";

/** Répare les états PrestaShop (payé Stripe mais PS en erreur, annule les abandons). */
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  let limit = 80;
  try {
    const body = (await request.json()) as { limit?: number };
    if (typeof body.limit === "number" && body.limit > 0) {
      limit = Math.min(200, body.limit);
    }
  } catch {
    // corps vide OK
  }

  const result = await repairPrestaShopOrderStates(limit);

  return NextResponse.json({
    message: `${result.markedPaid} commande(s) marquée(s) payée(s), ${result.cancelled} annulée(s).`,
    ...result,
  });
}
