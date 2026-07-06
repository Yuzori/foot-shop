"use client";

import { useEffect } from "react";

import { preloadStripe } from "@/lib/stripe-client";

/** Précharge Stripe.js dès le chargement de l'application. */
export function StripePreload() {
  useEffect(() => {
    preloadStripe();
  }, []);

  return null;
}
