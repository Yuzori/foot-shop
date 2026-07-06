/** Clé publique Stripe (côté navigateur uniquement). */
export const stripePublicConfig = {
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
  get enabled(): boolean {
    return Boolean(this.publishableKey);
  },
} as const;
