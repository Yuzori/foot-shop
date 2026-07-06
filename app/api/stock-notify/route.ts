import { NextResponse } from "next/server";

import { maybeProcessStockAlerts } from "@/lib/stock-notify";
import { prestashop } from "@/services/prestashop";

/** Déclenche l'envoi des emails « de retour en stock » (throttle 1×/min). */
export async function POST() {
  if (!prestashop.isConfigured) {
    return NextResponse.json({ sent: 0, message: "not_configured" });
  }

  const sent = await maybeProcessStockAlerts();
  return NextResponse.json({ sent });
}
