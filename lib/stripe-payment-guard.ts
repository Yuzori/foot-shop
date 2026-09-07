import "server-only";

import type Stripe from "stripe";

import { paymentConfig } from "@/config/payment";
import { getCheckoutPendingByReference } from "@/lib/checkout-pending-store";
import { getOrderArchiveByReference } from "@/lib/order-archive-store";
import { isCheckoutSessionPaidOnStripe } from "@/lib/stripe-checkout-session-status";
import { getStripe } from "@/lib/stripe-server";

function metaValue(value: unknown): string {
  return String(value ?? "").trim();
}

async function findPaidSessionForOrder(input: {
  orderId: string;
  reference: string;
}): Promise<Stripe.Checkout.Session | null> {
  const orderId = input.orderId.trim();
  const reference = input.reference.trim();
  if (!orderId || !reference) return null;

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
      if (isCheckoutSessionPaidOnStripe(session)) return session;
    } catch {
      // session introuvable
    }
  }

  let startingAfter: string | undefined;
  for (let page = 0; page < 15; page++) {
    const batch = await stripe.checkout.sessions.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const session of batch.data) {
      const metaOrderId = metaValue(session.metadata?.orderId);
      const metaReference = metaValue(session.metadata?.reference);
      if (
        (metaOrderId && metaOrderId === orderId) ||
        (metaReference && metaReference === reference)
      ) {
        if (isCheckoutSessionPaidOnStripe(session)) {
          return await stripe.checkout.sessions.retrieve(session.id, {
            expand: ["payment_intent"],
          });
        }
      }
    }

    if (!batch.has_more || batch.data.length === 0) break;
    startingAfter = batch.data[batch.data.length - 1]?.id;
  }

  return null;
}

export async function assertStripePaymentForOrder(input: {
  orderId: string;
  reference: string;
  checkoutSessionId?: string | null;
}): Promise<Stripe.Checkout.Session> {
  if (!paymentConfig.stripeEnabled) {
    throw new Error("Stripe désactivé - vérification paiement impossible.");
  }

  const orderId = input.orderId.trim();
  const reference = input.reference.trim();

  let session: Stripe.Checkout.Session | null = null;
  const directSessionId = input.checkoutSessionId?.trim() ?? "";

  if (directSessionId) {
    const stripe = getStripe();
    session = await stripe.checkout.sessions.retrieve(directSessionId, {
      expand: ["payment_intent"],
    });
  } else {
    session = await findPaidSessionForOrder({ orderId, reference });
  }

  if (!session) {
    throw new Error("Session Stripe introuvable pour cette commande.");
  }

  if (!isCheckoutSessionPaidOnStripe(session)) {
    throw new Error(
      `Paiement Stripe non confirmé (${session.payment_status ?? session.status}).`,
    );
  }

  const metaOrderId = metaValue(session.metadata?.orderId);
  if (metaOrderId && metaOrderId !== orderId) {
    throw new Error("Incohérence entre la commande et la session Stripe.");
  }

  return session;
}
