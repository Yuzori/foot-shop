import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { paymentConfig } from "@/config/payment";
import { fulfillPaidOrder } from "@/lib/order-paid";
import { markWelcomePromoUsed } from "@/lib/welcome-promo-store";
import { isCheckoutSessionPaidOnStripe } from "@/lib/stripe-checkout-session-status";
import { getStripe } from "@/lib/stripe-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fulfillSessionIfPaid(
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (!isCheckoutSessionPaidOnStripe(session)) {
    console.info(
      "[stripe] webhook ignoré — session non payée",
      session.id,
      session.payment_status,
      session.status,
    );
    return;
  }

  const orderId = session.metadata?.orderId;
  if (orderId) {
    await fulfillPaidOrder(
      orderId,
      session.metadata?.customerEmail ?? session.customer_email,
    );
  }
  if (
    session.metadata?.welcomePromo === "1" &&
    session.metadata.customerId
  ) {
    await markWelcomePromoUsed(session.metadata.customerId);
  }
}

/**
 * Stripe webhook. Configure it in the Stripe dashboard:
 *   URL: https://votre-domaine.com/api/webhooks/stripe
 *   Events: checkout.session.completed, checkout.session.async_payment_succeeded
 */
export async function POST(request: Request) {
  if (!paymentConfig.stripeEnabled || !paymentConfig.stripeWebhookSecret) {
    return NextResponse.json({ message: "stripe_disabled" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ message: "missing_signature" }, { status: 400 });
  }

  const raw = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      raw,
      signature,
      paymentConfig.stripeWebhookSecret,
    );
  } catch (err) {
    console.error("[stripe] webhook signature verification failed", err);
    return NextResponse.json({ message: "invalid_signature" }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    await fulfillSessionIfPaid(session);
  }

  if (event.type === "checkout.session.async_payment_failed") {
    console.warn(
      "[stripe] async payment failed",
      (event.data.object as Stripe.Checkout.Session).id,
    );
  }

  return NextResponse.json({ received: true });
}
