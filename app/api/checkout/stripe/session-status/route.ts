import { NextResponse } from "next/server";

import { paymentConfig } from "@/config/payment";
import { getOrderArchiveByReference } from "@/lib/order-archive-store";
import { hasOrderBeenFulfilled } from "@/lib/order-fulfillment-store";
import {
  classifyCheckoutSession,
  type CheckoutPaymentState,
} from "@/lib/stripe-checkout-session-status";
import { formatStripeError } from "@/lib/stripe-keys";
import { getStripe } from "@/lib/stripe-server";

export const runtime = "nodejs";

async function isOrderPaidLocally(input: {
  orderId: string | null;
  reference: string | null;
}): Promise<boolean> {
  if (input.orderId && (await hasOrderBeenFulfilled(input.orderId))) {
    return true;
  }
  if (!input.reference) return false;
  const archive = await getOrderArchiveByReference(input.reference);
  return Boolean(archive?.paidAt || archive?.status === "paid");
}

/** Vérifie le statut réel d'une Checkout Session (retour PayPal, 3DS, etc.). */
export async function GET(request: Request) {
  if (!paymentConfig.stripeEnabled) {
    return NextResponse.json({ message: "stripe_disabled" }, { status: 503 });
  }

  const sessionId = new URL(request.url).searchParams.get("session_id")?.trim();
  if (!sessionId || !sessionId.startsWith("cs_")) {
    return NextResponse.json(
      { message: "session_id invalide." },
      { status: 400 },
    );
  }

  const stripe = getStripe();

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });
    const status = classifyCheckoutSession(session);
    const fulfilled = await isOrderPaidLocally({
      orderId: status.orderId,
      reference: status.reference,
    });

    const state: CheckoutPaymentState =
      status.state === "paid" || fulfilled ? "paid" : status.state;

    return NextResponse.json({
      state,
      reason: status.reason ?? null,
      reference: status.reference,
      orderId: status.orderId,
      paymentStatus: status.paymentStatus,
      sessionStatus: status.sessionStatus,
      fulfilled,
    });
  } catch (error) {
    console.error("[stripe] session-status failed", error);
    return NextResponse.json(
      { message: formatStripeError(error) },
      { status: 502 },
    );
  }
}
