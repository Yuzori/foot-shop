import "server-only";

import { deleteCheckoutPending } from "@/lib/checkout-pending-store";
import { prestashop } from "@/services/prestashop";

const CANCELLED_STATE_ID = Number(
  process.env.PRESTASHOP_CANCELLED_STATE_ID ?? "6",
);

/** Annule une commande PrestaShop non payée (checkout abandonné). */
export async function cancelUnpaidPrestaShopOrder(
  orderId: string,
  reference: string,
): Promise<void> {
  const key = orderId.trim();
  const ref = reference.trim();
  if (!key || !ref) return;

  const history = await prestashop.addOrderHistory(key, CANCELLED_STATE_ID);
  if (!history.ok) {
    console.warn("[checkout] cancel unpaid order failed", key, history.error);
  }

  await deleteCheckoutPending(ref);
}
