import "server-only";

import type Stripe from "stripe";

export type StripeCheckoutPaymentMethodType = "card" | "link" | "paypal";

export function stripePreferredPaymentMethodTypes(): StripeCheckoutPaymentMethodType[] {
  return ["card", "link", "paypal"];
}

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

/** Crée une Checkout Session ; retire PayPal si le compte Stripe ne l'a pas encore activé. */
export async function createStripeElementsCheckoutSession(
  stripe: Stripe,
  params: Omit<Stripe.Checkout.SessionCreateParams, "payment_method_types">,
): Promise<{
  session: Stripe.Checkout.Session;
  paymentMethodTypes: StripeCheckoutPaymentMethodType[];
}> {
  let types = stripePreferredPaymentMethodTypes();

  try {
    const session = await stripe.checkout.sessions.create({
      ...params,
      payment_method_types: types,
    });
    return { session, paymentMethodTypes: types };
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
    return { session, paymentMethodTypes: types };
  }
}
