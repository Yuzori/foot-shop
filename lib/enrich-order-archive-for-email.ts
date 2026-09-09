import "server-only";

import { getCheckoutPendingByReference } from "@/lib/checkout-pending-store";
import {
  enrichOrderLinesWithFlocage,
  parseFlocageEntriesFromNote,
} from "@/lib/parse-flocage-note";
import type { OrderArchiveRecord } from "@/lib/order-archive-store";
import { prestashop } from "@/services/prestashop";

/** Archive complète pour l'email (flocage, adresse) depuis pending / note PrestaShop. */
export async function enrichOrderArchiveForEmail(
  archive: OrderArchiveRecord | null | undefined,
  orderId?: string | null,
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

  let note = enriched.note ?? "";

  if (!parseFlocageEntriesFromNote(note).length && orderId) {
    const context = await prestashop.getSupplierOrderContext(orderId).catch(() => null);
    if (context?.flocageNote?.trim()) {
      note = context.flocageNote.trim();
    }
  }

  return {
    ...enriched,
    note,
    lines: enrichOrderLinesWithFlocage(enriched.lines, note),
  };
}
