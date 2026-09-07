import "server-only";

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

/** Infos client visibles dans le dashboard Stripe (pas seulement metadata). */
export function buildStripeCheckoutCustomerDetails(
  contact: Contact,
  address: Address,
): {
  customer_details: {
    email: string;
    phone: string;
    name: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      postal_code: string;
      country: string;
    };
  };
  shipping_details: {
    name: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      postal_code: string;
      country: string;
    };
  };
} {
  const name = `${contact.firstName} ${contact.lastName}`.trim();
  const country = stripeCountryCode(address.country);
  const stripeAddress = {
    line1: address.address1.trim(),
    ...(address.address2?.trim() ? { line2: address.address2.trim() } : {}),
    city: address.city.trim(),
    postal_code: address.postcode.trim(),
    country,
  };

  return {
    customer_details: {
      email: contact.email.trim(),
      phone: contact.phone?.trim() || "",
      name,
      address: stripeAddress,
    },
    shipping_details: {
      name,
      address: stripeAddress,
    },
  };
}
