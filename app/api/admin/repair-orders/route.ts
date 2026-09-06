import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import { ensurePrestaShopOrderPaid } from "@/lib/mark-prestashop-order-paid";
import { repairPrestaShopOrderStates } from "@/lib/repair-prestashop-orders";
import { verifyPrestaShopOrderHasStripePayment } from "@/lib/stripe-order-reconcile";
import { prestashop } from "@/services/prestashop";

/** Répare les états PrestaShop (payé Stripe mais PS en erreur, annule les abandons). */
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  let limit = 80;
  let references: string[] = [];
  try {
    const body = (await request.json()) as { limit?: number; references?: string[] };
    if (typeof body.limit === "number" && body.limit > 0) {
      limit = Math.min(200, body.limit);
    }
    if (Array.isArray(body.references)) {
      references = body.references.map((ref) => ref.trim()).filter(Boolean);
    }
  } catch {
    // corps vide OK
  }

  if (references.length > 0) {
    const restored: string[] = [];
    const skipped: string[] = [];
    for (const reference of references) {
      const order = await prestashop.getOrderByReference(reference);
      if (!order) {
        skipped.push(reference);
        continue;
      }
      const stripePaid = await verifyPrestaShopOrderHasStripePayment(
        { orderId: order.id, reference },
        { strict: true },
      );
      if (!stripePaid) {
        skipped.push(reference);
        continue;
      }
      const ok = await ensurePrestaShopOrderPaid(order.id);
      if (ok) restored.push(reference);
      else skipped.push(reference);
    }
    return NextResponse.json({
      message: `${restored.length} commande(s) restaurée(s).`,
      restored,
      skipped,
    });
  }

  const result = await repairPrestaShopOrderStates(limit);

  return NextResponse.json({
    message: `${result.markedPaid} commande(s) marquée(s) payée(s), ${result.cancelled} annulée(s).`,
    ...result,
  });
}
