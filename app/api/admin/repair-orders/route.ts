import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import { fulfillPaidOrder } from "@/lib/order-paid";
import { repairPrestaShopOrderStates } from "@/lib/repair-prestashop-orders";
import { prestashop } from "@/services/prestashop";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Répare les états PrestaShop (payé Stripe mais PS en erreur, annule les abandons). */
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  try {
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
    const skipped: Array<{ reference: string; reason: string }> = [];
    for (const reference of references) {
      try {
        const order = await prestashop.getOrderByReference(reference);
        if (!order) {
          skipped.push({ reference, reason: "commande_introuvable" });
          continue;
        }
        await fulfillPaidOrder(order.id);
        restored.push(reference);
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "restauration_echouee";
        skipped.push({ reference, reason });
      }
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
  } catch (error) {
    console.error("[repair-orders] failed", error);
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Réparation impossible.",
      },
      { status: 500 },
    );
  }
}
