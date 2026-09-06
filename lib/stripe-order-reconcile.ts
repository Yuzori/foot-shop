import "server-only";

import { paymentConfig } from "@/config/payment";
import { getCheckoutPendingByReference } from "@/lib/checkout-pending-store";
import { getOrderArchiveByReference } from "@/lib/order-archive-store";
import { hasOrderBeenFulfilled } from "@/lib/order-fulfillment-store";
import { isCheckoutSessionPaidOnStripe } from "@/lib/stripe-checkout-session-status";
import { getStripe } from "@/lib/stripe-server";

/** Vérifie qu'une commande PrestaShop a un paiement Stripe confirmé. */
export async function verifyPrestaShopOrderHasStripePayment(input: {
  orderId: string;
  reference: string;
}): Promise<boolean> {
  if (!paymentConfig.stripeEnabled) return false;

  const orderId = input.orderId.trim();
  const reference = input.reference.trim();
  if (!orderId || !reference) return false;

  if (await hasOrderBeenFulfilled(orderId)) return true;

  const archive = await getOrderArchiveByReference(reference);
  if (archive?.paidAt || archive?.status === "paid") return true;

  const pending = await getCheckoutPendingByReference(reference);
  const sessionId = pending?.stripeSessionId?.trim() ?? archive?.stripeSessionId?.trim() ?? "";
  const stripe = getStripe();

  if (sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent"],
      });
      if (isCheckoutSessionPaidOnStripe(session)) return true;
    } catch {
      // session introuvable ou expirée
    }
  }

  // Recherche par métadonnées (commandes récentes sans pending local).
  const sessions = await stripe.checkout.sessions.list({ limit: 100 });
  for (const session of sessions.data) {
    const metaOrderId = session.metadata?.orderId?.trim() ?? "";
    const metaReference = session.metadata?.reference?.trim() ?? "";
    if (
      (metaOrderId && metaOrderId === orderId) ||
      (metaReference && metaReference === reference)
    ) {
      if (isCheckoutSessionPaidOnStripe(session)) return true;
    }
  }

  return false;
}
