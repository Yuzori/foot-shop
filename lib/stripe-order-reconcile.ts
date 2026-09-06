import "server-only";

import { paymentConfig } from "@/config/payment";
import { getCheckoutPendingByReference } from "@/lib/checkout-pending-store";
import { getOrderArchiveByReference } from "@/lib/order-archive-store";
import { hasOrderBeenFulfilled } from "@/lib/order-fulfillment-store";
import { isCheckoutSessionPaidOnStripe } from "@/lib/stripe-checkout-session-status";
import { getStripe } from "@/lib/stripe-server";

async function findPaidStripeSession(input: {
  orderId: string;
  reference: string;
}): Promise<boolean> {
  try {
    const orderId = input.orderId.trim();
    const reference = input.reference.trim();
    if (!orderId || !reference || !paymentConfig.stripeEnabled) return false;

    const archive = await getOrderArchiveByReference(reference);
    const pending = await getCheckoutPendingByReference(reference);
    const sessionId =
      pending?.stripeSessionId?.trim() ?? archive?.stripeSessionId?.trim() ?? "";
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

    let startingAfter: string | undefined;
    for (let page = 0; page < 15; page++) {
      const batch = await stripe.checkout.sessions.list({
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });

      for (const session of batch.data) {
        const metaOrderId = String(session.metadata?.orderId ?? "").trim();
        const metaReference = String(session.metadata?.reference ?? "").trim();
        if (
          (metaOrderId && metaOrderId === orderId) ||
          (metaReference && metaReference === reference)
        ) {
          if (isCheckoutSessionPaidOnStripe(session)) return true;
        }
      }

      if (!batch.has_more || batch.data.length === 0) break;
      startingAfter = batch.data[batch.data.length - 1]?.id;
    }

    return false;
  } catch (error) {
    console.error("[stripe-reconcile] lookup failed", input.reference, error);
    return false;
  }
}

/** Vérifie qu'une commande PrestaShop a un paiement Stripe confirmé. */
export async function verifyPrestaShopOrderHasStripePayment(
  input: {
    orderId: string;
    reference: string;
  },
  options?: { strict?: boolean },
): Promise<boolean> {
  const orderId = input.orderId.trim();
  const reference = input.reference.trim();
  if (!orderId || !reference) return false;

  const stripePaid = await findPaidStripeSession({ orderId, reference });
  if (stripePaid) return true;

  if (options?.strict) return false;

  if (await hasOrderBeenFulfilled(orderId)) return true;

  const archive = await getOrderArchiveByReference(reference);
  if (archive?.paidAt || archive?.status === "paid") return true;

  return false;
}
