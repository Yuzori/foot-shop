import "server-only";

import type Stripe from "stripe";

export type CheckoutPaymentState = "paid" | "pending" | "failed";

export interface CheckoutSessionStatus {
  state: CheckoutPaymentState;
  reason?: string;
  reference: string | null;
  orderId: string | null;
  paymentStatus: Stripe.Checkout.Session.PaymentStatus;
  sessionStatus: Stripe.Checkout.Session.Status | null;
}

function paymentIntentStatus(
  session: Stripe.Checkout.Session,
): string | null {
  const pi = session.payment_intent;
  if (!pi) return null;
  if (typeof pi === "string") return null;
  return pi.status ?? null;
}

/** Classifie une Checkout Session Stripe (retours PayPal, 3DS, etc.). */
export function classifyCheckoutSession(
  session: Stripe.Checkout.Session,
): CheckoutSessionStatus {
  const reference = session.metadata?.reference ?? null;
  const orderId = session.metadata?.orderId ?? null;
  const paymentStatus = session.payment_status;
  const sessionStatus = session.status;

  if (
    paymentStatus === "paid" ||
    paymentStatus === "no_payment_required"
  ) {
    return {
      state: "paid",
      reference,
      orderId,
      paymentStatus,
      sessionStatus,
    };
  }

  if (sessionStatus === "expired") {
    return {
      state: "failed",
      reason: "expired",
      reference,
      orderId,
      paymentStatus,
      sessionStatus,
    };
  }

  const piStatus = paymentIntentStatus(session);
  if (piStatus === "processing" || piStatus === "requires_action") {
    return {
      state: "pending",
      reason: "processing",
      reference,
      orderId,
      paymentStatus,
      sessionStatus,
    };
  }

  return {
    state: "failed",
    reason: "cancelled_or_unpaid",
    reference,
    orderId,
    paymentStatus,
    sessionStatus,
  };
}

export function isCheckoutSessionPaidOnStripe(
  session: Stripe.Checkout.Session,
): boolean {
  return classifyCheckoutSession(session).state === "paid";
}
