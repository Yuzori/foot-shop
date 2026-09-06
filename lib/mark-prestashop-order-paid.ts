import "server-only";

import { paymentConfig } from "@/config/payment";
import { prestashop } from "@/services/prestashop";
import { isPrestaShopPaidState } from "@/lib/prestashop-order-states";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Marque une commande PrestaShop comme payée (idempotent si déjà payée). */
export async function ensurePrestaShopOrderPaid(orderId: string): Promise<boolean> {
  const key = orderId.trim();
  if (!key || !prestashop.isConfigured) return false;

  const currentState = await prestashop.getOrderCurrentStateId(key);
  if (isPrestaShopPaidState(currentState)) return true;

  const primary = paymentConfig.paidStateId;
  const fallbacks = [primary, 11, 2].filter(
    (state, index, list) => list.indexOf(state) === index,
  );

  for (const stateId of fallbacks) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const history = await prestashop.addOrderHistory(key, stateId);
      if (history.ok) {
        const updated = await prestashop.getOrderCurrentStateId(key);
        if (isPrestaShopPaidState(updated)) return true;
      }
      await sleep(400 * (attempt + 1));
    }
  }

  return false;
}
