import { loadStripe, type Stripe } from "@stripe/stripe-js";

import { stripePublicConfig } from "@/config/payment-public";

const stripePromises = new Map<string, Promise<Stripe | null>>();

/** Instance Stripe.js partagée (singleton par clé publique). */
export function getStripePromise(
  publishableKey?: string,
): Promise<Stripe | null> {
  const key = (publishableKey ?? stripePublicConfig.publishableKey).trim();
  if (!key) return Promise.resolve(null);

  let promise = stripePromises.get(key);
  if (!promise) {
    promise = loadStripe(key);
    stripePromises.set(key, promise);
  }
  return promise;
}

/** Précharge Stripe.js au début de la session pour réduire la latence au checkout. */
export function preloadStripe(): void {
  if (stripePublicConfig.enabled) {
    void getStripePromise();
  }
}

export function isCheckoutSessionPaid(
  status: { type: string; paymentStatus?: string },
): boolean {
  return status.type === "complete" && status.paymentStatus === "paid";
}
