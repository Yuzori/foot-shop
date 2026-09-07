import "server-only";

import type Stripe from "stripe";

import { resolveCountry } from "@/lib/checkout-contact-validation";

type Contact = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
};

type Address = {
  address1: string;
  address2?: string;
  postcode: string;
  city: string;
  country: string;
};

function stripeCountryCode(country: string): string {
  return resolveCountry(country)?.code ?? "FR";
}

/** Met à jour le client Stripe (téléphone, adresse) - visible dans le dashboard. */
export async function syncStripeCustomerCheckoutDetails(
  stripe: Stripe,
  stripeCustomerId: string,
  contact: Contact,
  address: Address,
): Promise<void> {
  const name = `${contact.firstName} ${contact.lastName}`.trim();
  const country = stripeCountryCode(address.country);
  const stripeAddress = {
    line1: address.address1.trim(),
    ...(address.address2?.trim() ? { line2: address.address2.trim() } : {}),
    city: address.city.trim(),
    postal_code: address.postcode.trim(),
    country,
  };

  await stripe.customers.update(stripeCustomerId, {
    email: contact.email.trim(),
    ...(contact.phone?.trim() ? { phone: contact.phone.trim() } : {}),
    ...(name ? { name } : {}),
    address: stripeAddress,
    shipping: {
      name: name || "Client",
      address: stripeAddress,
    },
  });
}
