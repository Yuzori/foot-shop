import "server-only";

import { paymentConfig } from "@/config/payment";
import { shopConfig } from "@/config/shop";
import { flocageTestPromo } from "@/config/promotions";
import { getCheckoutPendingByReference } from "@/lib/checkout-pending-store";
import { enrichOrderLinesFromStripeMeta } from "@/lib/enrich-archive-lines-from-stripe";
import {
  enrichOrderLinesWithFlocage,
  parseFlocageEntriesFromNote,
} from "@/lib/parse-flocage-note";
import type { OrderArchiveRecord } from "@/lib/order-archive-store";
import { parseStripeOrderLinesFromMetadata } from "@/lib/stripe-order-metadata";
import { getStripe } from "@/lib/stripe-server";
import { prestashop } from "@/services/prestashop";
import type { CreateOrderLine } from "@/services/prestashop";

function lineNeedsFlocage(lines: CreateOrderLine[]): boolean {
  return lines.some(
    (line) => !line.flocage?.name?.trim() && !line.flocage?.text?.trim(),
  );
}

function resolveFlocageUnitPrice(archive: OrderArchiveRecord): number {
  return archive.promoCode === flocageTestPromo.code
    ? flocageTestPromo.flocagePrice
    : shopConfig.flocagePrice;
}

/** Archive complète pour l'email client (flocage, adresse) depuis pending / PS / Stripe. */
export async function enrichOrderArchiveForEmail(
  archive: OrderArchiveRecord | null | undefined,
  orderId?: string | null,
  checkoutSessionId?: string | null,
): Promise<OrderArchiveRecord | null> {
  if (!archive) return null;

  let enriched: OrderArchiveRecord = { ...archive, lines: [...archive.lines] };

  const pending = await getCheckoutPendingByReference(archive.reference);
  if (pending?.lines.length) {
    enriched = {
      ...enriched,
      contact: pending.contact,
      address: pending.address,
      lines: pending.lines,
      subtotal: pending.subtotal,
      shippingFee: pending.shippingFee,
      promoCode: pending.promoCode,
      promoDiscount: pending.promoDiscount,
      total: pending.total,
      note: pending.note ?? enriched.note,
      stripeSessionId:
        enriched.stripeSessionId ?? pending.stripeSessionId ?? checkoutSessionId ?? null,
    };
  } else if (checkoutSessionId && !enriched.stripeSessionId) {
    enriched = { ...enriched, stripeSessionId: checkoutSessionId };
  }

  let note = enriched.note ?? "";

  if (lineNeedsFlocage(enriched.lines) && orderId) {
    if (!parseFlocageEntriesFromNote(note).length) {
      const context = await prestashop.getSupplierOrderContext(orderId).catch(() => null);
      if (context?.flocageNote?.trim()) {
        note = context.flocageNote.trim();
      }
    }
  }

  let lines = enrichOrderLinesWithFlocage(enriched.lines, note);

  if (lineNeedsFlocage(lines)) {
    const sessionId = enriched.stripeSessionId?.trim();
    if (sessionId && paymentConfig.stripeEnabled) {
      try {
        const session = await getStripe().checkout.sessions.retrieve(sessionId);
        const stripeLines = parseStripeOrderLinesFromMetadata(session.metadata ?? {});
        lines = enrichOrderLinesFromStripeMeta(
          lines,
          stripeLines,
          resolveFlocageUnitPrice(enriched),
        );
      } catch (err) {
        console.warn("[email-enrich] stripe metadata failed", archive.reference, err);
      }
    }
  }

  return {
    ...enriched,
    note,
    lines,
  };
}
