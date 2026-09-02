import "server-only";

import type Stripe from "stripe";

import { paymentConfig } from "@/config/payment";
import { getCheckoutPendingByReference } from "@/lib/checkout-pending-store";
import { isCheckoutSessionPaidOnStripe } from "@/lib/stripe-checkout-session-status";
import { getStripe } from "@/lib/stripe-server";

export async function assertStripePaymentForOrder(input: {
  orderId: string;
  reference: string;
  checkoutSessionId?: string | null;
}): Promise<Stripe.Checkout.Session> {
  if (!paymentConfig.stripeEnabled) {
    throw new Error("Stripe désactivé — vérification paiement impossible.");
  }

  const stripe = getStripe();
  const sessionId =
    input.checkoutSessionId?.trim() ||
    (await getCheckoutPendingByReference(input.reference))?.stripeSessionId?.trim() ||
    "";

  if (!sessionId) {
    throw new Error("Session Stripe introuvable pour cette commande.");
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });

  if (!isCheckoutSessionPaidOnStripe(session)) {
    throw new Error(
      `Paiement Stripe non confirmé (${session.payment_status ?? session.status}).`,
    );
  }

  const metaOrderId = session.metadata?.orderId?.trim() ?? "";
  const metaReference = session.metadata?.reference?.trim() ?? "";
  if (metaOrderId && metaOrderId !== input.orderId.trim()) {
    throw new Error("Incohérence entre la commande et la session Stripe.");
  }
  if (metaReference && metaReference !== input.reference.trim()) {
    throw new Error("Incohérence de référence avec la session Stripe.");
  }

  return session;
}
