import "server-only";

import { isPrestaShopPaidState } from "@/lib/prestashop-order-states";
import { getOrderArchiveByReference } from "@/lib/order-archive-store";
import { isOrderDismissedFromRecovery } from "@/lib/order-admin-dismissals";
import { isTestOrderReference } from "@/lib/is-test-order";
import { rebuildArchiveFromPrestaShopOrder } from "@/lib/rebuild-order-archive";
import { restoreArchivesFromBackups } from "@/lib/restore-order-archives";
import { syncMissingSupplierDrafts } from "@/lib/ensure-supplier-draft";
import { hasOrderCustomerEmailsBeenSent } from "@/lib/order-customer-email-store";
import { verifyPrestaShopOrderHasStripePayment } from "@/lib/stripe-order-reconcile";
import { sendPaidOrderCustomerEmailsIfNeeded } from "@/lib/send-paid-order-customer-emails";
import { notifySupplierOfOrder } from "@/lib/supplier-order";
import { getSupplierOrderDraft } from "@/lib/supplier-order-store";
import { prestashop } from "@/services/prestashop";

const CANCELLED_STATE_ID = String(
  process.env.PRESTASHOP_CANCELLED_STATE_ID ?? "6",
);

const RECOVERY_COOLDOWN_MS = 45_000;

let lastRecoveryAt = 0;
let lastRecoveryResult: {
  restoredFromBackup: number;
  rebuiltFromPrestaShop: number;
  supplierDrafts: number;
  customerEmailsSent: number;
  references: string[];
} | null = null;

const PAYMENT_ERROR_STATE_ID = "8";
const AWAITING_PAYMENT_STATE_ID = "1";

function isRecoverablePrestaShopOrder(currentState: string | null): boolean {
  if (!currentState || currentState === CANCELLED_STATE_ID) return false;
  if (currentState === PAYMENT_ERROR_STATE_ID) return false;
  if (currentState === AWAITING_PAYMENT_STATE_ID) return false;
  return isPrestaShopPaidState(currentState);
}

/**
 * Répare historique + commandes BBDBuy au chargement admin :
 * backup → PrestaShop → brouillons fournisseur.
 */
export async function runAdminOrderRecovery(
  limit = 100,
  options?: { force?: boolean },
): Promise<{
  restoredFromBackup: number;
  rebuiltFromPrestaShop: number;
  supplierDrafts: number;
  customerEmailsSent: number;
  references: string[];
}> {
  const now = Date.now();
  if (
    !options?.force &&
    lastRecoveryResult &&
    now - lastRecoveryAt < RECOVERY_COOLDOWN_MS
  ) {
    return lastRecoveryResult;
  }

  const references: string[] = [];

  const backup = await restoreArchivesFromBackups({ paidOnly: true }).catch((err) => {
    console.error("[admin-recovery] backup restore failed", err);
    return { restored: 0, skipped: 0, references: [] as string[] };
  });
  references.push(...backup.references);

  let rebuiltFromPrestaShop = 0;
  let customerEmailsSent = 0;
  const recent = await prestashop.listRecentOrders(limit).catch((err) => {
    console.error("[admin-recovery] list recent orders failed", err);
    return [];
  });

  for (const psOrder of recent) {
    const orderId = String(psOrder.id ?? "").trim();
    const reference = psOrder.reference?.trim() ?? "";
    if (!orderId || !reference) continue;
    if (isTestOrderReference(reference)) continue;
    if (await isOrderDismissedFromRecovery(reference)) continue;

    if (!isRecoverablePrestaShopOrder(psOrder.current_state ?? null)) {
      continue;
    }

    const stripePaid = await verifyPrestaShopOrderHasStripePayment({
      orderId,
      reference,
    });
    if (!stripePaid) {
      continue;
    }

    const customerId = await prestashop.getOrderCustomerId(orderId);
    if (customerId) {
      await prestashop.repairCustomerBackOffice(customerId).catch((err) => {
        console.warn("[admin-recovery] customer repair failed", customerId, err);
      });
    }

    const existing = await getOrderArchiveByReference(reference);
    if (!existing) {
      const rebuilt = await rebuildArchiveFromPrestaShopOrder(orderId).catch((err) => {
        console.error("[admin-recovery] rebuild failed", reference, err);
        return null;
      });
      if (rebuilt) {
        rebuiltFromPrestaShop += 1;
        references.push(reference);
      }
    }

    const draft = await getSupplierOrderDraft(reference);
    const order = await prestashop.getOrderById(orderId);
    if (!draft && order) {
      await notifySupplierOfOrder(order, orderId).catch((err) => {
        console.error("[admin-recovery] supplier draft failed", reference, err);
      });
    }

    if (order && !(await hasOrderCustomerEmailsBeenSent(orderId))) {
      const archive = (await getOrderArchiveByReference(reference)) ?? existing;
      const sent = await sendPaidOrderCustomerEmailsIfNeeded({
        order,
        orderId,
        archive,
      }).catch((err) => {
        console.error("[admin-recovery] customer emails failed", reference, err);
        return false;
      });
      if (sent) customerEmailsSent += 1;
    }
  }

  const supplierDrafts = await syncMissingSupplierDrafts(limit).catch((err) => {
    console.error("[admin-recovery] sync drafts failed", err);
    return 0;
  });

  const result = {
    restoredFromBackup: backup.restored,
    rebuiltFromPrestaShop,
    supplierDrafts,
    customerEmailsSent,
    references: [...new Set(references)],
  };

  lastRecoveryAt = now;
  lastRecoveryResult = result;
  return result;
}
