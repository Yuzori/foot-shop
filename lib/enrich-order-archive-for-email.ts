import "server-only";

import { getCheckoutPendingByReference } from "@/lib/checkout-pending-store";
import { enrichOrderLinesWithFlocage } from "@/lib/parse-flocage-note";
import type { OrderArchiveRecord } from "@/lib/order-archive-store";

function linesMissingFlocage(lines: OrderArchiveRecord["lines"]): boolean {
  return lines.some((line) => !line.flocage?.name && !line.flocage?.text);
}

/** Archive complète pour l'email (flocage, adresse) depuis pending / note / Stripe. */
export async function enrichOrderArchiveForEmail(
  archive: OrderArchiveRecord | null | undefined,
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
    };
  }

  if (linesMissingFlocage(enriched.lines)) {
    enriched = {
      ...enriched,
      lines: enrichOrderLinesWithFlocage(enriched.lines, enriched.note),
    };
  }

  if (linesMissingFlocage(enriched.lines) && enriched.note) {
    enriched = {
      ...enriched,
      lines: enrichOrderLinesWithFlocage(enriched.lines, enriched.note),
    };
  }

  return enriched;
}
