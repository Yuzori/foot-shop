import "server-only";

import { recordCheckoutAbandon } from "@/lib/checkout-abandons-store";
import { getCheckoutPendingByReference } from "@/lib/checkout-pending-store";
import {
  orderLinesToStripeMeta,
  parseStripeOrderLinesFromMetadata,
} from "@/lib/stripe-order-metadata";
import type Stripe from "stripe";

function customerName(firstName: string, lastName: string): string {
  const name = `${firstName} ${lastName}`.trim();
  return name || "User";
}

/** Enregistre un abandon (webhook ou erreur session). */
export async function recordCheckoutAbandonFromSession(
  session: Stripe.Checkout.Session,
  cause: string,
): Promise<void> {
  const metadata = session.metadata ?? {};
  const reference = metadata.reference?.trim();
  if (!reference) return;

  const pending = await getCheckoutPendingByReference(reference);
  const linesFromMeta = parseStripeOrderLinesFromMetadata(metadata);
  const lines =
    linesFromMeta.length > 0
      ? linesFromMeta
      : pending
        ? orderLinesToStripeMeta(
            pending.lines.map((line) => ({
              ...line,
              optionsLabel: undefined,
            })),
          )
        : [];

  await recordCheckoutAbandon({
    reference,
    sessionId: session.id,
    createdAt: new Date((session.created ?? 0) * 1000).toISOString(),
    cause,
    customerName: pending
      ? customerName(pending.contact.firstName, pending.contact.lastName)
      : metadata.shippingName?.trim() || "User",
    email:
      pending?.contact.email?.trim() ||
      metadata.customerEmail?.trim() ||
      session.customer_email?.trim() ||
      "",
    phone: pending?.contact.phone?.trim() || metadata.customerPhone?.trim() || "",
    total: pending?.total ?? (session.amount_total ?? 0) / 100,
    currency: pending?.currency ?? (session.currency ?? "eur").toUpperCase(),
    lines,
  });
}

export async function recordCheckoutAbandonFromPending(
  reference: string,
  cause: string,
  lines?: ReturnType<typeof orderLinesToStripeMeta>,
): Promise<void> {
  const pending = await getCheckoutPendingByReference(reference);
  if (!pending) return;

  await recordCheckoutAbandon({
    reference,
    sessionId: pending.stripeSessionId ?? null,
    createdAt: pending.createdAt,
    cause,
    customerName: customerName(pending.contact.firstName, pending.contact.lastName),
    email: pending.contact.email,
    phone: pending.contact.phone?.trim() || "",
    total: pending.total,
    currency: pending.currency,
    lines:
      lines ??
      orderLinesToStripeMeta(
        pending.lines.map((line) => ({
          ...line,
          optionsLabel: undefined,
        })),
      ),
  });
}
