import "server-only";

import type { CheckoutPendingRecord } from "@/lib/checkout-pending-store";
import type { OrderArchiveRecord } from "@/lib/order-archive-store";

type CheckoutContact = Pick<OrderArchiveRecord, "contact"> | Pick<CheckoutPendingRecord, "contact">;

/** Email saisi au checkout - prioritaire sur le compte PrestaShop / Stripe. */
export function resolveCheckoutNotificationEmail(input: {
  archive?: CheckoutContact | null;
  checkoutEmail?: string | null;
  fallbackEmail?: string | null;
}): string | null {
  const fromArchive = input.archive?.contact.email?.trim();
  if (fromArchive) return fromArchive;

  const fromCheckout = input.checkoutEmail?.trim();
  if (fromCheckout) return fromCheckout;

  const fallback = input.fallbackEmail?.trim();
  return fallback || null;
}
