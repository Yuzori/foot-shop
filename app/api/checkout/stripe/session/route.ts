import { NextResponse } from "next/server";

import { getCheckoutBaseUrl } from "@/lib/site-url";
import { paymentConfig } from "@/config/payment";
import { placeOrder, type CheckoutBody } from "@/lib/orders";
import { attachStripeSessionToPending } from "@/lib/checkout-pending-store";
import { cancelUnpaidPrestaShopOrder } from "@/lib/cancel-unpaid-order";
import { getStripe } from "@/lib/stripe-server";
import { getOrCreateStripeCustomer } from "@/lib/stripe-customer";
import { ensureStripePaymentMethodDomains } from "@/lib/stripe-payment-domains";
import { createStripeElementsCheckoutSession } from "@/lib/stripe-create-checkout-session";
import {
  buildStripeLineItemDescription,
  buildStripeOrderMetadata,
  type OrderLineForMetadata,
} from "@/lib/stripe-order-metadata";
import { recordCheckoutAbandonFromPending } from "@/lib/record-checkout-abandon";
import { buildStripeCheckoutCustomerDetails } from "@/lib/stripe-checkout-customer-details";
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
  savePaymentMethod?: boolean;
}

/**
 * Crée la commande PrestaShop puis une Checkout Session Stripe (ui_mode:
 * elements) pour le Payment Element intégré sur Foot Shop.
 */
export async function POST(request: Request) {
  try {
    return await handleStripeSession(request);
  } catch (error) {
    console.error("[stripe/session] unhandled", error);
    return NextResponse.json(
      { message: "Impossible de préparer le paiement. Réessayez dans un instant." },
      { status: 500 },
    );
  }
}

async function handleStripeSession(request: Request) {
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

  const checkoutBaseUrl = getCheckoutBaseUrl();
  const siteCheck = validateStripeSiteUrl(
    paymentConfig.stripeSecretKey,
    checkoutBaseUrl,
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
  const base = checkoutBaseUrl.replace(/\/$/, "");
  const ref = order.reference ?? "";
  const returnUrl = `${base}/paiement/succes?ref=${encodeURIComponent(ref)}&session_id={CHECKOUT_SESSION_ID}`;

  const chargeLines = serverLines.map((line) => ({
    name: line.name || "Article",
    unitPrice: line.unitPrice,
    quantity: line.quantity,
  }));
  const bogoApplied = Boolean(order.bogoApplied);
  const bogoDiscount = order.bogoDiscount ?? 0;
  const freeUnits = bogoApplied
    ? calculateWelcomeBogo(
        body.items.map((item) => ({
          name: item.name,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        })),
      ).freeUnits
    : 0;

  const shippingFee = order.shippingFee ?? 0;
  const productsSubtotal = chargeLines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  const promoDiscount = order.promoDiscount ?? 0;
  const promoCode = order.promoCode ?? null;

  const stripeLineItems = chargeLines.map((it, index) => {
    const sourceLine: OrderLineForMetadata = {
      ...(serverLines[index] ?? {
        productId: "",
        variantId: null,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        name: it.name,
      }),
      optionsLabel: body.lines[index]?.optionsLabel,
    };
    const description = buildStripeLineItemDescription(sourceLine);
    return {
      quantity: it.quantity,
      price_data: {
        currency: paymentConfig.currency,
        unit_amount: Math.round(it.unitPrice * 100),
        product_data: {
          name: it.name || "Article",
          ...(description ? { description } : {}),
        },
      },
    };
  });

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

  if (promoDiscount > 0 && promoCode) {
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
      item.price_data.product_data.name = `${line.name} (${promoCode})`;
    }
  }

  const expectedTotalCents = Math.round(
    (productsSubtotal - promoDiscount + shippingFee) * 100,
  );

  await ensureStripePaymentMethodDomains();
  const stripeCustomerId = await getOrCreateStripeCustomer({
    email: body.contact.email,
    customerId: order.customerId,
    firstName: body.contact.firstName,
    lastName: body.contact.lastName,
  });
  const savePayment = Boolean(stripeCustomerId);
  const stripeCustomerDetails = buildStripeCheckoutCustomerDetails(
    body.contact,
    body.address,
  );
  const orderMetadata = buildStripeOrderMetadata({
    reference: ref,
    orderId: String(order.orderId ?? ""),
    customerId: order.customerId ?? "",
    contact: body.contact,
    address: body.address,
    lines: serverLines.map((line, index) => ({
      ...line,
      optionsLabel: body.lines[index]?.optionsLabel,
    })),
    welcomePromo: bogoApplied,
    expectedTotalCents,
    bogoFreeUnits: bogoApplied ? freeUnits : undefined,
    promoCode,
    promoDiscountCents: promoDiscount > 0 ? Math.round(promoDiscount * 100) : undefined,
    shippingCents: Math.round(shippingFee * 100),
  });

  try {
    const { session, paymentMethodTypes, paymentMethodConfiguration } =
      await createStripeElementsCheckoutSession(stripe, {
      mode: "payment",
      ui_mode: "elements",
      ...(stripeCustomerId
        ? { customer: stripeCustomerId }
        : { customer_email: body.contact.email || undefined }),
      ...(savePayment && stripeCustomerId
        ? {
            saved_payment_method_options: {
              payment_method_save: "enabled",
            },
          }
        : {}),
      line_items: stripeLineItems,
      ...stripeCustomerDetails,
      metadata: orderMetadata,
      payment_intent_data: {
        metadata: {
          reference: ref,
          orderId: String(order.orderId ?? ""),
          customerPhone: orderMetadata.customerPhone ?? "",
          phone: orderMetadata.customerPhone ?? "",
          shippingAddress: orderMetadata.shippingAddress ?? "",
          address: orderMetadata.shippingAddress ?? "",
        },
      },
      return_url: returnUrl,
    });

    if (!session.client_secret) {
      return NextResponse.json(
        { message: "Stripe n'a pas renvoyé de client_secret." },
        { status: 502 },
      );
    }

    await attachStripeSessionToPending(ref, session.id);

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
      promoCode: promoCode,
      paymentMethodTypes,
      paymentMethodConfiguration,
    });
  } catch (error) {
    console.error("[stripe] checkout.sessions.create failed", error);
    if (order.ok && order.orderId && order.reference) {
      await recordCheckoutAbandonFromPending(
        String(order.reference),
        "Erreur d'ouverture du paiement Stripe — redirection impossible",
        serverLines.map((line, index) => ({
          name: line.name?.trim() || `Produit #${line.productId}`,
          quantity: line.quantity,
          size: body.lines[index]?.optionsLabel?.replace(/^taille:\s*/i, "").trim() || "",
          flocage: line.flocage
            ? [line.flocage.name, line.flocage.number, line.flocage.text].filter(Boolean).join(" ")
            : "",
        })),
      ).catch((abandonErr) => {
        console.warn("[stripe/session] abandon record failed", abandonErr);
      });
      await cancelUnpaidPrestaShopOrder(
        String(order.orderId),
        String(order.reference),
      ).catch((cancelErr) => {
        console.warn("[stripe/session] cancel orphan order failed", cancelErr);
      });
    }
    return NextResponse.json(
      { message: formatStripeError(error) },
      { status: 502 },
    );
  }
}
