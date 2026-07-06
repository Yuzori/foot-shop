import { NextResponse } from "next/server";

import { publicConfig } from "@/config";
import { paymentConfig } from "@/config/payment";
import { welcomePromo } from "@/config/promotions";
import { getSession } from "@/lib/auth";
import { placeOrder, type CheckoutBody } from "@/lib/orders";
import { isWelcomePromoEligible } from "@/lib/welcome-promo-store";
import { getStripe } from "@/lib/stripe-server";
import {
  formatStripeError,
  getStripePublishableKey,
  validateStripeKeyPair,
  validateStripeSiteUrl,
} from "@/lib/stripe-keys";
import { calculateWelcomeBogo } from "@/lib/welcome-bogo";

export const runtime = "nodejs";

interface StripeSessionBody extends CheckoutBody {
  items: { name: string; unitPrice: number; quantity: number }[];
  applyWelcomePromo?: boolean;
}

/**
 * Crée la commande PrestaShop puis une Checkout Session Stripe (ui_mode:
 * elements) pour le Payment Element intégré sur Foot Shop.
 */
export async function POST(request: Request) {
  if (!paymentConfig.stripeEnabled) {
    return NextResponse.json({ message: "stripe_disabled" }, { status: 503 });
  }

  const publishableKey = getStripePublishableKey();
  const keyCheck = validateStripeKeyPair(
    paymentConfig.stripeSecretKey,
    publishableKey,
  );
  if (!keyCheck.ok) {
    return NextResponse.json({ message: keyCheck.message }, { status: 502 });
  }

  const siteCheck = validateStripeSiteUrl(
    paymentConfig.stripeSecretKey,
    publicConfig.siteUrl,
  );
  if (!siteCheck.ok) {
    return NextResponse.json({ message: siteCheck.message }, { status: 502 });
  }

  let body: StripeSessionBody;
  try {
    body = (await request.json()) as StripeSessionBody;
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const order = await placeOrder(body);
  if (!order.ok) {
    return NextResponse.json(
      { message: order.message, detail: order.detail },
      { status: order.status },
    );
  }

  const serverLines = order.lines ?? [];
  if (serverLines.length === 0) {
    return NextResponse.json({ message: "Panier vide." }, { status: 400 });
  }

  const stripe = getStripe();
  const base = publicConfig.siteUrl.replace(/\/$/, "");
  const ref = order.reference ?? "";
  const returnUrl = `${base}/paiement/succes?ref=${encodeURIComponent(ref)}&session_id={CHECKOUT_SESSION_ID}`;

  const authSession = await getSession();
  let bogoApplied = false;
  let bogoDiscount = 0;
  let freeUnits = 0;
  let chargeLines = serverLines.map((line) => ({
    name: line.name || "Article",
    unitPrice: line.unitPrice,
    quantity: line.quantity,
  }));

  const promoEligible =
    welcomePromo.enabled &&
    authSession?.id &&
    order.customerId &&
    String(authSession.id) === String(order.customerId) &&
    (await isWelcomePromoEligible(String(authSession.id)));

  if (promoEligible) {
    const bogo = calculateWelcomeBogo(chargeLines);
    if (bogo.applied) {
      bogoApplied = true;
      bogoDiscount = bogo.discountTotal;
      freeUnits = bogo.freeUnits;
      chargeLines = bogo.adjustedLines.map((line) => ({
        ...line,
        name: `${line.name} (${welcomePromo.shortLabel})`,
      }));
    }
  }

  const expectedTotalCents = Math.round(
    chargeLines.reduce(
      (sum, line) => sum + line.unitPrice * line.quantity,
      0,
    ) * 100,
  );

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "elements",
      payment_method_types: ["card"],
      customer_email: body.contact.email || undefined,
      line_items: chargeLines.map((it) => ({
        quantity: it.quantity,
        price_data: {
          currency: paymentConfig.currency,
          unit_amount: Math.round(it.unitPrice * 100),
          product_data: {
            name: it.name || "Article",
          },
        },
      })),
      metadata: {
        orderId: String(order.orderId ?? ""),
        reference: ref,
        customerEmail: body.contact.email,
        customerId: order.customerId ?? "",
        welcomePromo: bogoApplied ? "1" : "",
        expectedTotalCents: String(expectedTotalCents),
        bogoFreeUnits: bogoApplied ? String(freeUnits) : "",
      },
      return_url: returnUrl,
    });

    if (!session.client_secret) {
      return NextResponse.json(
        { message: "Stripe n'a pas renvoyé de client_secret." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      clientSecret: session.client_secret,
      checkoutSessionId: session.id,
      reference: order.reference,
      orderId: order.orderId,
      returnUrl,
      publishableKey,
      bogoApplied,
      bogoDiscount,
      freeUnits,
    });
  } catch (error) {
    console.error("[stripe] checkout.sessions.create failed", error);
    return NextResponse.json(
      { message: formatStripeError(error) },
      { status: 502 },
    );
  }
}
