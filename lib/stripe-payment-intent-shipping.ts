import "server-only";

import { resolveCountry } from "@/lib/checkout-contact-validation";

type Contact = {
  firstName: string;
  lastName: string;
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

/** Adresse de livraison sur le PaymentIntent (visible dans Stripe). */
export function buildStripePaymentIntentShipping(
  contact: Contact,
  address: Address,
): {
  name: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    postal_code: string;
    country: string;
  };
} {
  const name = `${contact.firstName} ${contact.lastName}`.trim() || "Client";
  const country = stripeCountryCode(address.country);

  return {
    name,
    address: {
      line1: address.address1.trim(),
      ...(address.address2?.trim() ? { line2: address.address2.trim() } : {}),
      city: address.city.trim(),
      postal_code: address.postcode.trim(),
      country,
    },
  };
}
