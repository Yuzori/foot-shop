import { NextResponse } from "next/server";

import { paymentConfig } from "@/config/payment";
import {
  getStripePublishableKey,
  validateStripeKeyPair,
} from "@/lib/stripe-keys";

/** Expose la clé publique Stripe au client. */
export async function GET() {
  const publishableKey = getStripePublishableKey();
  const keyCheck = validateStripeKeyPair(
    paymentConfig.stripeSecretKey,
    publishableKey,
  );

  if (!keyCheck.ok) {
    return NextResponse.json({
      publishableKey: "",
      enabled: false,
      error: keyCheck.message,
    });
  }

  return NextResponse.json({
    publishableKey,
    enabled: paymentConfig.stripeEnabled && Boolean(publishableKey),
    error: null,
  });
}
