import { NextResponse } from "next/server";

import { getOrderShipping } from "@/lib/order-shipping-store";
import { prestashop } from "@/services/prestashop";

/** Track an order by its reference (read-only). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("reference") ?? "";

  if (!reference.trim()) {
    return NextResponse.json(
      { message: "Référence de commande requise" },
      { status: 400 },
    );
  }

  const order = await prestashop.getOrderByReference(reference);

  if (!order) {
    return NextResponse.json(
      { message: "Aucune commande trouvée pour cette référence" },
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
