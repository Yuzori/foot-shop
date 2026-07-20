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
import { validatePromoCodeForCheckout } from "@/lib/validate-promo-code";

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

  const shippingFee = order.shippingFee ?? 0;
  const productsSubtotal = chargeLines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  const promoValidation = await validatePromoCodeForCheckout({
    code: body.promoCode,
    email: body.contact.email,
    customerId: order.customerId,
    subtotal: productsSubtotal,
  });
  if (body.promoCode?.trim() && promoValidation && !promoValidation.valid) {
    return NextResponse.json({ message: promoValidation.message }, { status: 400 });
  }
  const promo =
    promoValidation?.valid === true
      ? {
          valid: true as const,
          code: promoValidation.code,
          percent: promoValidation.percent,
          label: promoValidation.label,
        }
      : null;
  const promoDiscount =
    promoValidation?.valid === true ? promoValidation.discount : 0;

  const stripeLineItems = chargeLines.map((it) => ({
    quantity: it.quantity,
    price_data: {
      currency: paymentConfig.currency,
      unit_amount: Math.round(it.unitPrice * 100),
      product_data: {
        name: it.name || "Article",
      },
    },
  }));

  if (shippingFee > 0) {
    stripeLineItems.push({
      quantity: 1,
      price_data: {
        currency: paymentConfig.currency,
        unit_amount: Math.round(shippingFee * 100),
        product_data: {
          name: "Livraison",
        },
      },
    });
  }

  if (promoDiscount > 0) {
    const subtotal = chargeLines.reduce(
      (sum, line) => sum + line.unitPrice * line.quantity,
      0,
    );
    let remaining = promoDiscount;
    for (let i = 0; i < chargeLines.length; i++) {
      const line = chargeLines[i]!;
      const lineTotal = line.unitPrice * line.quantity;
      const share =
        i === chargeLines.length - 1
          ? remaining
          : Math.round(((promoDiscount * lineTotal) / subtotal) * 100) / 100;
      remaining -= share;
      if (share <= 0) continue;
      const item = stripeLineItems[i];
      if (!item) continue;
      const newTotal = Math.max(0.01, lineTotal - share);
      item.price_data.unit_amount = Math.round(
        (newTotal / line.quantity) * 100,
      );
      item.price_data.product_data.name = `${line.name} (${promo!.code})`;
    }
  }

  const expectedTotalCents = Math.round(
    (productsSubtotal - promoDiscount + shippingFee) * 100,
  );

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "elements",
      payment_method_types: ["card"],
      customer_email: body.contact.email || undefined,
      line_items: stripeLineItems,
      metadata: {
        orderId: String(order.orderId ?? ""),
        reference: ref,
        customerEmail: body.contact.email,
        customerId: order.customerId ?? "",
        welcomePromo: bogoApplied ? "1" : "",
        expectedTotalCents: String(expectedTotalCents),
        bogoFreeUnits: bogoApplied ? String(freeUnits) : "",
        promoCode: promo?.valid ? promo.code : "",
        promoDiscountCents: promoDiscount > 0 ? String(Math.round(promoDiscount * 100)) : "",
        shippingCents: String(Math.round(shippingFee * 100)),
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
      shippingFee,
      shippingLabel: order.shippingLabel,
      promoDiscount,
      promoCode: promo?.valid ? promo.code : null,
    });
  } catch (error) {
    console.error("[stripe] checkout.sessions.create failed", error);
    return NextResponse.json(
      { message: formatStripeError(error) },
      { status: 502 },
    );
  }
}
