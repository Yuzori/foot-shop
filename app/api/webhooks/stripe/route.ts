import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { paymentConfig } from "@/config/payment";
import { fulfillPaidOrder } from "@/lib/order-paid";
import { markWelcomePromoUsed } from "@/lib/welcome-promo-store";
import { getStripe } from "@/lib/stripe-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook. Configure it in the Stripe dashboard:
 *   URL: https://votre-domaine.com/api/webhooks/stripe
 *   Event: checkout.session.completed
 *
 * On a successful payment, the matching PrestaShop order is moved to the
 * "Paiement accepté" state.
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
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

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const orderId = intent.metadata?.orderId;
    if (orderId) {
      await fulfillPaidOrder(orderId, intent.metadata?.customerEmail);
    }
  }

  return NextResponse.json({ received: true });
}
