import "server-only";

import { buildBbdBuyOrderDraftFromArchive } from "@/lib/bbdbuy/build-draft";
import { getOrderArchiveByReference, listPaidOrderArchives } from "@/lib/order-archive-store";
import { isOrderDismissedFromRecovery } from "@/lib/order-admin-dismissals";
import { isTestOrderReference } from "@/lib/is-test-order";
import { notifySupplierOfOrder } from "@/lib/supplier-order";
import { getSupplierOrderDraft, saveSupplierOrderDraft } from "@/lib/supplier-order-store";
import { sendBbdBuyOperatorEmail } from "@/lib/supplier-order-email";
import { prestashop } from "@/services/prestashop";
import type { Order } from "@/types/domain";

function isPaidArchive(record: {
  paidAt: string | null;
  status: string;
}): boolean {
  return record.status === "paid" || Boolean(record.paidAt);
}

/** Crée le brouillon BBDBuy s'il manque (idempotent). */
export async function ensureSupplierOrderDraftForOrder(
  order: Order,
  orderId: string,
): Promise<boolean> {
  const existing = await getSupplierOrderDraft(order.reference);
  if (existing && existing.status !== "archived") return false;

  await notifySupplierOfOrder(order, orderId, {
    force: existing?.status === "archived",
  });
  return true;
}

/** Récupère un brouillon depuis l'archive locale si PrestaShop ne répond pas. */
export async function ensureSupplierDraftFromArchiveReference(
  reference: string,
): Promise<boolean> {
  const ref = reference.trim();
  if (!ref) return false;

  const existing = await getSupplierOrderDraft(ref);
  if (existing && existing.status !== "archived") return false;

  const archive = await getOrderArchiveByReference(ref);
  if (!archive || !isPaidArchive(archive)) return false;

  if (archive.orderId) {
    const order = await prestashop.getOrderById(archive.orderId);
    if (order) {
      await notifySupplierOfOrder(order, archive.orderId, { force: true });
      return true;
    }
  }

  const draft = await buildBbdBuyOrderDraftFromArchive(archive);
  await saveSupplierOrderDraft(draft);
  try {
    await sendBbdBuyOperatorEmail(draft);
  } catch (err) {
    console.error("[supplier] archive draft email failed", ref, err);
  }
  return true;
}

/** Répare les commandes payées absentes des commandes récentes (admin). */
export async function syncMissingSupplierDrafts(limit = 80): Promise<number> {
  const archives = await listPaidOrderArchives(limit);
  let created = 0;

  for (const record of archives) {
    if (!isPaidArchive(record)) continue;
    if (isTestOrderReference(record.reference)) continue;
    if (await isOrderDismissedFromRecovery(record.reference)) continue;

    const existing = await getSupplierOrderDraft(record.reference);
    if (existing && existing.status !== "archived") continue;

    let ok = false;
    if (record.orderId) {
      const order = await prestashop.getOrderById(record.orderId);
      if (order) {
        ok = await ensureSupplierOrderDraftForOrder(order, record.orderId);
      }
    }

    if (!ok) {
      ok = await ensureSupplierDraftFromArchiveReference(record.reference);
    }

    if (ok) created += 1;
  }

  return created;
}
