import "server-only";

import type { AbandonedCheckout } from "@/lib/abandoned-checkouts-types";
import type { CheckoutPendingRecord } from "@/lib/checkout-pending-store";
import { listCheckoutPendingRecords } from "@/lib/checkout-pending-store";

const ABANDON_MINUTES = 10;

export type { AbandonedCheckout } from "@/lib/abandoned-checkouts-types";

function customerName(record: CheckoutPendingRecord): string {
  const name = `${record.contact.firstName} ${record.contact.lastName}`.trim();
  return name || "User";
}

function lineName(line: CheckoutPendingRecord["lines"][number]): string {
  const base = line.name?.trim() || `Produit #${line.productId}`;
  const flocage = line.flocage;
  if (!flocage) return base;
  const parts = [flocage.name, flocage.number, flocage.text].filter(Boolean);
  if (parts.length === 0) return base;
  return `${base} (${parts.join(" ")})`;
}

/** Checkouts démarrés mais non payés — informatif admin, hors commandes BBDBuy. */
export async function listAbandonedCheckouts(): Promise<AbandonedCheckout[]> {
  const records = await listCheckoutPendingRecords();
  const cutoff = Date.now() - ABANDON_MINUTES * 60_000;

  return records
    .filter((record) => {
      const created = new Date(record.createdAt).getTime();
      return Number.isFinite(created) && created <= cutoff;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((record) => ({
      reference: record.reference,
      createdAt: record.createdAt,
      customerName: customerName(record),
      email: record.contact.email,
      total: record.total,
      currency: record.currency,
      lines: record.lines.map((line) => ({
        name: lineName(line),
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
    }));
}
