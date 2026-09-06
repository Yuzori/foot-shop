import { NextResponse } from "next/server";

import { getOrderArchiveByReference } from "@/lib/order-archive-store";
import { isPaidOrderStatus } from "@/lib/customer-order-history";
import { getOrderShipping } from "@/lib/order-shipping-store";
import { isPrestaShopPaidState } from "@/lib/prestashop-order-states";
import { resolveOrderForTracking } from "@/lib/resolve-order-for-tracking";
import { verifyPrestaShopOrderHasStripePayment } from "@/lib/stripe-order-reconcile";
import { prestashop } from "@/services/prestashop";

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

  const archive = await getOrderArchiveByReference(order.reference);
  const stripePaid = await verifyPrestaShopOrderHasStripePayment({
    orderId: order.id,
    reference: order.reference,
  }).catch(() => false);

  const archivePaid = Boolean(archive?.paidAt || archive?.status === "paid");
  const psState = await prestashop.getOrderCurrentStateId(order.id).catch(() => null);
  const psPaid = isPrestaShopPaidState(psState);

  if (archivePaid || stripePaid || psPaid) {
    if (!isPaidOrderStatus(status) || status === "unknown") {
      status = "processing";
      statusLabel = trackingNumber ? "Expédiée" : "Paiement accepté";
    }
  }

  if (trackingNumber && (status === "processing" || status === "unknown")) {
    status = "shipped";
    statusLabel = "Expédiée";
  }

  if (status === "unknown" && archivePaid) {
    status = "processing";
    statusLabel = "Paiement accepté";
  }

  return NextResponse.json({
    ...order,
    status,
    statusLabel,
    trackingNumber,
    trackingUrl,
    shippingPending: !trackingNumber && (archivePaid || stripePaid || psPaid),
    shippingNotifiedAt: shipping?.sentAt ?? null,
  });
}
