import "server-only";

import { getStripe } from "@/lib/stripe-server";
import {
  readUserPreferences,
  writeUserPreferences,
} from "@/lib/user-preferences";

/** Récupère ou crée un client Stripe lié au compte Foot Shop. */
export async function getOrCreateStripeCustomer(input: {
  email: string;
  customerId?: string | null;
  firstName?: string;
  lastName?: string;
}): Promise<string | null> {
  const email = input.email.trim().toLowerCase();
  if (!email) return null;

  const stripe = getStripe();
  const customerId = input.customerId?.trim();

  if (customerId) {
    const prefs = await readUserPreferences(customerId);
    const existingId = prefs.stripeCustomerId?.trim();
    if (existingId) {
      try {
        const existing = await stripe.customers.retrieve(existingId);
        if (!existing.deleted) {
          if (email && existing.email?.toLowerCase() !== email) {
            await stripe.customers.update(existingId, { email });
          }
          return existingId;
        }
      } catch {
        /* recréer */
      }
    }
  }

  const created = await stripe.customers.create({
    email,
    name: [input.firstName, input.lastName].filter(Boolean).join(" ").trim() || undefined,
    metadata: customerId ? { prestashopCustomerId: customerId } : undefined,
  });

  if (customerId) {
    const current = await readUserPreferences(customerId);
    await writeUserPreferences(customerId, {
      cart: current.cart,
      favorites: current.favorites,
      checkoutProfile: current.checkoutProfile,
      stripeCustomerId: created.id,
    });
  }

  return created.id;
}
