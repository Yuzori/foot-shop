import "server-only";

import type { OrderArchiveRecord } from "@/lib/order-archive-store";

/** Email saisi au checkout — prioritaire sur le compte PrestaShop / Stripe. */
export function resolveCheckoutNotificationEmail(input: {
  archive?: Pick<OrderArchiveRecord, "contact"> | null;
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
