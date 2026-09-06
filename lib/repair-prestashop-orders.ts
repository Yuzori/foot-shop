import "server-only";

import { cancelUnpaidPrestaShopOrder } from "@/lib/cancel-unpaid-order";
import { ensurePrestaShopOrderPaid } from "@/lib/mark-prestashop-order-paid";
import { isPrestaShopPaidState } from "@/lib/prestashop-order-states";
import { verifyPrestaShopOrderHasStripePayment } from "@/lib/stripe-order-reconcile";
import { prestashop } from "@/services/prestashop";

const PAYMENT_ERROR_STATE_ID = "8";
const AWAITING_PAYMENT_STATE_ID = "1";
const STALE_UNPAID_HOURS = 6;

function isStaleUnpaid(dateAdd: string | null | undefined): boolean {
  if (!dateAdd) return false;
  const created = new Date(dateAdd.replace(" ", "T"));
  if (Number.isNaN(created.getTime())) return false;
  const ageHours = (Date.now() - created.getTime()) / (1000 * 60 * 60);
  return ageHours >= STALE_UNPAID_HOURS;
}

/** Aligne les états PrestaShop avec les paiements Stripe réels. */
export async function repairPrestaShopOrderStates(limit = 80): Promise<{
  markedPaid: number;
  cancelled: number;
  references: string[];
}> {
  const references: string[] = [];
  let markedPaid = 0;
  let cancelled = 0;

  const recent = await prestashop.listRecentOrders(limit).catch(() => []);

  for (const psOrder of recent) {
    const orderId = String(psOrder.id ?? "").trim();
    const reference = psOrder.reference?.trim() ?? "";
    if (!orderId || !reference) continue;

    const state = String(psOrder.current_state ?? "");
    const stripePaid = await verifyPrestaShopOrderHasStripePayment({
      orderId,
      reference,
    });

    if (stripePaid && !isPrestaShopPaidState(state)) {
      const ok = await ensurePrestaShopOrderPaid(orderId);
      if (ok) {
        markedPaid += 1;
        references.push(reference);
      }
      continue;
    }

    if (
      !stripePaid &&
      (state === AWAITING_PAYMENT_STATE_ID || state === PAYMENT_ERROR_STATE_ID) &&
      isStaleUnpaid(psOrder.date_add)
    ) {
      await cancelUnpaidPrestaShopOrder(orderId, reference).catch((err) => {
        console.warn("[repair-ps] cancel failed", reference, err);
      });
      cancelled += 1;
      references.push(reference);
    }
  }

  return { markedPaid, cancelled, references: [...new Set(references)] };
}
