import "server-only";

import type Stripe from "stripe";

import { paymentConfig } from "@/config/payment";

export type StripeCheckoutPaymentMethodType = "card" | "link" | "paypal";

export function stripePreferredPaymentMethodTypes(): StripeCheckoutPaymentMethodType[] {
  return ["card", "link", "paypal"];
}

type SessionParams = Omit<
  Stripe.Checkout.SessionCreateParams,
  "payment_method_types" | "payment_method_configuration"
>;

function isPaypalUnavailableError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : String(error);
  const lower = message.toLowerCase();
  return lower.includes("paypal") && lower.includes("invalid");
}

/**
 * Crée une Checkout Session Stripe Elements.
 * Utilise la PMC dashboard (pmc_…) si définie — Apple Pay, Link, PayPal, Samsung Pay…
 */
export async function createStripeElementsCheckoutSession(
  stripe: Stripe,
  params: SessionParams,
): Promise<{
  session: Stripe.Checkout.Session;
  paymentMethodTypes: StripeCheckoutPaymentMethodType[] | null;
  paymentMethodConfiguration: string | null;
}> {
  const pmcId = paymentConfig.stripePaymentMethodConfigurationId;

  if (pmcId) {
    const session = await stripe.checkout.sessions.create({
      ...params,
      payment_method_configuration: pmcId,
    });
    return {
      session,
      paymentMethodTypes: null,
      paymentMethodConfiguration: pmcId,
    };
  }

  let types = stripePreferredPaymentMethodTypes();

  try {
    const session = await stripe.checkout.sessions.create({
      ...params,
      payment_method_types: types,
    });
    return { session, paymentMethodTypes: types, paymentMethodConfiguration: null };
  } catch (error) {
    if (!types.includes("paypal") || !isPaypalUnavailableError(error)) {
      throw error;
    }

    console.warn(
      "[stripe] PayPal indisponible sur ce compte — session sans PayPal.",
    );
    types = types.filter((type) => type !== "paypal");

    const session = await stripe.checkout.sessions.create({
      ...params,
      payment_method_types: types,
    });
    return { session, paymentMethodTypes: types, paymentMethodConfiguration: null };
  }
}
