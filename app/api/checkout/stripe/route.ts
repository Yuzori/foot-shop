import { NextResponse } from "next/server";

import { publicConfig } from "@/config";
import { paymentConfig } from "@/config/payment";
import { placeOrder, type CheckoutBody } from "@/lib/orders";
import { getStripe } from "@/lib/stripe-server";
export const runtime = "nodejs";

interface StripeCheckoutBody extends CheckoutBody {
  items: { name: string; unitPrice: number; quantity: number }[];
}

/**
 * Creates the PrestaShop order (awaiting payment) then a Stripe Checkout
 * Session, and returns its URL. The order is marked paid by the webhook after
 * the payment succeeds. Returns 503 if Stripe isn't configured so the client
 * can fall back to the plain order flow.
 */
export async function POST(request: Request) {
  if (!paymentConfig.stripeEnabled) {
    return NextResponse.json({ message: "stripe_disabled" }, { status: 503 });
  }

  let body: StripeCheckoutBody;
  try {
    body = (await request.json()) as StripeCheckoutBody;
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

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: body.contact.email,
    line_items: serverLines.map((it) => ({
      quantity: it.quantity,
      price_data: {
        currency: paymentConfig.currency,
        unit_amount: Math.round(it.unitPrice * 100),
        product_data: { name: it.name || "Article" },
      },
    })),
    metadata: {
      orderId: String(order.orderId ?? ""),
      reference: order.reference ?? "",
    },
    success_url: `${base}/paiement/succes?ref=${encodeURIComponent(order.reference ?? "")}`,
    cancel_url: `${base}/paiement?canceled=1`,
  });

  return NextResponse.json({ url: session.url, reference: order.reference });
}
