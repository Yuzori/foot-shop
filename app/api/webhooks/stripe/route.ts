import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { paymentConfig } from "@/config/payment";
import { cancelUnpaidPrestaShopOrder } from "@/lib/cancel-unpaid-order";
import { fulfillPaidOrder } from "@/lib/order-paid";
import { getCheckoutSnapshotByReference } from "@/lib/checkout-snapshot";
import { resolveCheckoutNotificationEmail } from "@/lib/checkout-notification-email";
import { recordCheckoutAbandonFromSession } from "@/lib/record-checkout-abandon";
import { removeCheckoutAbandonByReference } from "@/lib/checkout-abandons-store";
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
      "[stripe] webhook ignoré - session non payée",
      session.id,
      session.payment_status,
      session.status,
    );
    return;
  }

  const orderId = session.metadata?.orderId;
  if (orderId) {
    const snapshot = session.metadata?.reference
      ? await getCheckoutSnapshotByReference(session.metadata.reference)
      : null;
    const customerEmail = resolveCheckoutNotificationEmail({
      archive: snapshot,
      checkoutEmail: session.metadata?.customerEmail ?? session.customer_email,
    });
    await fulfillPaidOrder(orderId, customerEmail, {
      checkoutSessionId: session.id,
    });
    if (session.metadata?.reference) {
      await removeCheckoutAbandonByReference(session.metadata.reference);
    }
  }
  if (
    session.metadata?.welcomePromo === "1" &&
    session.metadata.customerId
  ) {
    await markWelcomePromoUsed(session.metadata.customerId);
  }
}

async function cancelSessionIfUnpaid(
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (isCheckoutSessionPaidOnStripe(session)) return;

  const orderId = session.metadata?.orderId?.trim() ?? "";
  const reference = session.metadata?.reference?.trim() ?? "";
  if (!orderId || !reference) return;

  await cancelUnpaidPrestaShopOrder(orderId, reference);
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

  if (
    event.type === "checkout.session.async_payment_failed" ||
    event.type === "checkout.session.expired"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    console.warn("[stripe] checkout session unpaid", event.type, session.id);
    const cause =
      event.type === "checkout.session.expired"
        ? "Session expirée — le client a quitté sans payer"
        : "Échec du paiement — erreur sur la plateforme de paiement";
    await recordCheckoutAbandonFromSession(session, cause);
    await cancelSessionIfUnpaid(session);
  }

  return NextResponse.json({ received: true });
}
