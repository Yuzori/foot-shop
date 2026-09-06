import "server-only";

import { paymentConfig } from "@/config/payment";
import { getOrderArchiveByReference } from "@/lib/order-archive-store";
import { rebuildArchiveFromPrestaShopOrder } from "@/lib/rebuild-order-archive";
import { restoreArchivesFromBackups } from "@/lib/restore-order-archives";
import { syncMissingSupplierDrafts } from "@/lib/ensure-supplier-draft";
import { notifySupplierOfOrder } from "@/lib/supplier-order";
import { getSupplierOrderDraft } from "@/lib/supplier-order-store";
import { prestashop } from "@/services/prestashop";

const CANCELLED_STATE_ID = String(
  process.env.PRESTASHOP_CANCELLED_STATE_ID ?? "6",
);

function isRecoverablePrestaShopOrder(input: {
  currentState: string | null;
  totalPaid: number;
}): boolean {
  if (input.currentState === CANCELLED_STATE_ID) return false;
  if (input.currentState === String(paymentConfig.paidStateId)) return true;
  return input.totalPaid > 0;
}

/**
 * Répare historique + commandes BBDBuy au chargement admin :
 * backup → PrestaShop → brouillons fournisseur.
 */
export async function runAdminOrderRecovery(limit = 100): Promise<{
  restoredFromBackup: number;
  rebuiltFromPrestaShop: number;
  supplierDrafts: number;
  references: string[];
}> {
  const references: string[] = [];

  const backup = await restoreArchivesFromBackups({ paidOnly: true }).catch((err) => {
    console.error("[admin-recovery] backup restore failed", err);
    return { restored: 0, skipped: 0, references: [] as string[] };
  });
  references.push(...backup.references);

  let rebuiltFromPrestaShop = 0;
  const recent = await prestashop.listRecentOrders(limit).catch((err) => {
    console.error("[admin-recovery] list recent orders failed", err);
    return [];
  });

  for (const psOrder of recent) {
    const orderId = String(psOrder.id ?? "").trim();
    const reference = psOrder.reference?.trim() ?? "";
    if (!orderId || !reference) continue;

    const totalPaid = Number.parseFloat(psOrder.total_paid ?? "0") || 0;
    if (
      !isRecoverablePrestaShopOrder({
        currentState: psOrder.current_state ?? null,
        totalPaid,
      })
    ) {
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
    if (!draft || draft.status === "archived") {
      const order = await prestashop.getOrderById(orderId);
      if (order) {
        await notifySupplierOfOrder(order, orderId, {
          force: draft?.status === "archived",
        }).catch((err) => {
          console.error("[admin-recovery] supplier draft failed", reference, err);
        });
      }
    }
  }

  const supplierDrafts = await syncMissingSupplierDrafts(limit).catch((err) => {
    console.error("[admin-recovery] sync drafts failed", err);
    return 0;
  });

  return {
    restoredFromBackup: backup.restored,
    rebuiltFromPrestaShop,
    supplierDrafts,
    references: [...new Set(references)],
  };
}
