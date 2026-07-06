import { NextResponse } from "next/server";

import { welcomePromo } from "@/config/promotions";
import { getSession } from "@/lib/auth";
import {
  getWelcomePromoStatus,
  grantWelcomePromo,
} from "@/lib/welcome-promo-store";
import { prestashop } from "@/services/prestashop";

/** Statut de l’offre de bienvenue pour le compte client connecté. */
export async function GET() {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({
      status: "none" as const,
      enabled: welcomePromo.enabled,
    });
  }

  let status = await getWelcomePromoStatus(session.id);

  // Comptes créés avant l’offre ou sans entrée dans le store : 1ʳᵉ commande = éligible.
  if (welcomePromo.enabled && status === "none" && prestashop.isConfigured) {
    const orders = await prestashop.getOrdersByCustomer(session.id);
    if (orders.length === 0) {
      await grantWelcomePromo(session.id);
      status = "eligible";
    }
  }

  return NextResponse.json({
    status,
    enabled: welcomePromo.enabled,
    code: status === "eligible" ? welcomePromo.code || null : null,
    label: welcomePromo.label,
    checkoutLabel: welcomePromo.checkoutLabel,
    shortLabel: welcomePromo.shortLabel,
  });
}
