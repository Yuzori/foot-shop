import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { paymentConfig } from "@/config/payment";
import { fulfillPaidOrder } from "@/lib/order-paid";
import { markWelcomePromoUsed } from "@/lib/welcome-promo-store";
import { formatStripeError } from "@/lib/stripe-keys";
import { getStripe } from "@/lib/stripe-server";

export const runtime = "nodejs";

function isSessionPaid(session: Stripe.Checkout.Session): boolean {
  return session.payment_status === "paid" || session.status === "complete";
}

async function retrievePaidSession(
  stripe: Stripe,
  checkoutSessionId: string,
): Promise<Stripe.Checkout.Session> {
  const delays = [0, 500, 1000, 1500, 2000];

  for (const delay of delays) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    if (isSessionPaid(session)) {
      return session;
    }
  }

  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
  if (!isSessionPaid(session)) {
    throw new Error(
      `Paiement non finalisé (statut : ${session.status}, paiement : ${session.payment_status}).`,
    );
  }
  return session;
}

/** Vérifie une Checkout Session payée et marque la commande PrestaShop comme payée. */
export async function POST(request: Request) {
  if (!paymentConfig.stripeEnabled) {
    return NextResponse.json({ message: "stripe_disabled" }, { status: 503 });
  }

  let body: { checkoutSessionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const checkoutSessionId = body.checkoutSessionId?.trim();
  if (!checkoutSessionId) {
    return NextResponse.json(
      { message: "checkoutSessionId requis." },
      { status: 400 },
    );
  }

  const stripe = getStripe();

  try {
    const session = await retrievePaidSession(stripe, checkoutSessionId);
    const orderId = session.metadata?.orderId;
    const reference = session.metadata?.reference ?? null;
    const customerEmail = session.metadata?.customerEmail ?? session.customer_email;

    if (orderId) {
      await fulfillPaidOrder(orderId, customerEmail);
    }

    if (
      session.metadata?.welcomePromo === "1" &&
      session.metadata.customerId
    ) {
      await markWelcomePromoUsed(session.metadata.customerId);
    }

    return NextResponse.json({
      ok: true,
      reference,
      orderId: orderId ?? null,
    });
  } catch (error) {
    console.error("[stripe] confirm failed", error);
    const message =
      error instanceof Error ? error.message : formatStripeError(error);
    const status = message.includes("non finalisé") ? 400 : 502;
    return NextResponse.json({ message }, { status });
  }
}
