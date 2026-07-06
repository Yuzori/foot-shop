import "server-only";

import Stripe from "stripe";

import { paymentConfig } from "@/config/payment";

/** Version API requise pour Checkout Sessions en `ui_mode: "elements"`. */
export const STRIPE_API_VERSION = "2026-03-25.dahlia" as const;

let stripeClient: Stripe | null = null;

/** Client Stripe serveur (API dahlia+ pour Payment Element / Checkout Sessions). */
export function getStripe(): Stripe {
  if (!paymentConfig.stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY non configurée.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(paymentConfig.stripeSecretKey, {
      apiVersion: STRIPE_API_VERSION,
    });
  }

  return stripeClient;
}
