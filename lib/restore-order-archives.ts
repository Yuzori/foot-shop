import "server-only";

import crypto from "node:crypto";

import {
  archiveOrder,
  getOrderArchiveByReference,
  type OrderArchiveRecord,
} from "@/lib/order-archive-store";
import {
  readAllOrderBackups,
  type OrderBackupEntry,
} from "@/lib/order-backup-store";

function backupEntryScore(entry: OrderBackupEntry): number {
  if (entry.event === "paid" || entry.status === "paid") return 3;
  if (entry.event === "shipping_updated") return 2;
  return 1;
}

function pickLatestBackupPerReference(
  entries: OrderBackupEntry[],
): Map<string, OrderBackupEntry> {
  const byRef = new Map<string, OrderBackupEntry>();

  for (const entry of entries) {
    const ref = entry.reference.trim();
    if (!ref) continue;

    const existing = byRef.get(ref);
    if (!existing) {
      byRef.set(ref, entry);
      continue;
    }

    const entryScore = backupEntryScore(entry);
    const existingScore = backupEntryScore(existing);
    if (
      entryScore > existingScore ||
      (entryScore === existingScore && entry.at > existing.at)
    ) {
      byRef.set(ref, entry);
    }
  }

  return byRef;
}

function isPaidBackupEntry(entry: OrderBackupEntry): boolean {
  return entry.event === "paid" || entry.status === "paid";
}

function backupToArchiveRecord(entry: OrderBackupEntry): OrderArchiveRecord {
  const paid = isPaidBackupEntry(entry);
  return {
    id: `ord-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    reference: entry.reference,
    orderId: entry.orderId,
    customerId: entry.customerId,
    createdAt: entry.at,
    paidAt: paid ? entry.at : null,
    status: paid ? "paid" : "created",
    contact: entry.contact,
    address: entry.address,
    lines: entry.lines,
    subtotal: entry.subtotal,
    shippingFee: entry.shippingFee,
    promoCode: entry.promoCode,
    promoDiscount: entry.promoDiscount,
    total: entry.total,
    currency: entry.currency,
    note: entry.note,
    stripeSessionId: entry.stripeSessionId ?? null,
    source: "stripe",
    stockReserved: true,
  };
}

export async function restoreArchivesFromBackups(input?: {
  references?: string[];
  excludeReferences?: string[];
  paidOnly?: boolean;
}): Promise<{
  restored: number;
  skipped: number;
  references: string[];
}> {
  const allow = input?.references?.map((ref) => ref.trim()).filter(Boolean);
  const exclude = new Set(
    (input?.excludeReferences ?? []).map((ref) => ref.trim()).filter(Boolean),
  );
  const paidOnly = input?.paidOnly !== false;

  const entries = await readAllOrderBackups();
  const latestByRef = pickLatestBackupPerReference(entries);

  let restored = 0;
  let skipped = 0;
  const references: string[] = [];

  for (const [reference, entry] of latestByRef) {
    if (allow && !allow.includes(reference)) {
      skipped += 1;
      continue;
    }
    if (exclude.has(reference)) {
      skipped += 1;
      continue;
    }
    if (paidOnly && !isPaidBackupEntry(entry)) {
      skipped += 1;
      continue;
    }

    const existing = await getOrderArchiveByReference(reference);
    if (existing) {
      skipped += 1;
      continue;
    }

    await archiveOrder(backupToArchiveRecord(entry));
    restored += 1;
    references.push(reference);
  }

  return { restored, skipped, references };
}
