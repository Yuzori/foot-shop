import { NextResponse } from "next/server";

import { placeOrder, type CheckoutBody } from "@/lib/orders";

/**
 * Creates a real order in PrestaShop (state: "Awaiting payment").
 *
 * Card capture itself is handled by Stripe (see /api/checkout/stripe). This
 * endpoint registers the order so it appears in the Back Office, in the
 * customer's order history and in order tracking — used as the fallback when
 * Stripe is not configured.
 */
export async function POST(request: Request) {
  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const result = await placeOrder(body);
  if (!result.ok) {
    return NextResponse.json(
      { message: result.message, detail: result.detail },
      { status: result.status },
    );
  }

  return NextResponse.json({
    reference: result.reference,
    orderId: result.orderId,
  });
}
