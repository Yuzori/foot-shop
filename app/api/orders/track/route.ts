import { NextResponse } from "next/server";

import { getOrderShipping } from "@/lib/order-shipping-store";
import { resolveOrderForTracking } from "@/lib/resolve-order-for-tracking";

export const runtime = "nodejs";

/** Track an order by reference or PrestaShop order number (read-only). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("reference") ?? "";

  if (!reference.trim()) {
    return NextResponse.json(
      { message: "Référence ou numéro de commande requis" },
      { status: 400 },
    );
  }

  const order = await resolveOrderForTracking(reference);

  if (!order) {
    return NextResponse.json(
      {
        message:
          "Aucune commande trouvée. Vérifiez la référence (email de confirmation) ou le numéro de commande.",
      },
      { status: 404 },
    );
  }

  const shipping = await getOrderShipping(order.reference);
  const trackingNumber =
    shipping?.trackingNumber || order.trackingNumber || null;
  const trackingUrl = shipping?.carrierUrl || null;

  let status = order.status;
  let statusLabel = order.statusLabel;
  if (trackingNumber && status === "processing") {
    status = "shipped";
    statusLabel = "Expédiée";
  }

  return NextResponse.json({
    ...order,
    status,
    statusLabel,
    trackingNumber,
    trackingUrl,
    shippingPending: !trackingNumber,
    shippingNotifiedAt: shipping?.sentAt ?? null,
  });
}
