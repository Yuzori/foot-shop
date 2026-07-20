import "server-only";

import type { Order, OrderStatus } from "@/types/domain";
import { prestashop } from "@/services/prestashop";

const PAID_STATUSES = new Set<OrderStatus>([
  "processing",
  "shipped",
  "delivered",
]);

/** Commande considérée comme payée (hors brouillon / annulation). */
export function isPaidOrderStatus(status: OrderStatus): boolean {
  return PAID_STATUSES.has(status);
}

export function filterPaidOrders(orders: readonly Order[]): Order[] {
  return orders.filter((order) => isPaidOrderStatus(order.status));
}

/** Nombre de commandes payées pour un client PrestaShop. */
export async function countPaidOrdersByCustomer(
  customerId: string,
): Promise<number> {
  const id = customerId.trim();
  if (!id || !prestashop.isConfigured) return 0;

  const orders = await prestashop.getOrdersByCustomer(id);
  return filterPaidOrders(orders).length;
}

/** Résout l’ID client puis compte les commandes payées. */
export async function countPaidOrdersForCheckout(input: {
  email: string;
  customerId?: string | null;
}): Promise<number> {
  if (!prestashop.isConfigured) return 0;

  let customerId = input.customerId?.trim() || "";
  if (!customerId && input.email.trim()) {
    const existing = await prestashop.getCustomerAuthByEmail(input.email.trim());
    customerId = existing?.id ?? "";
  }
  if (!customerId) return 0;

  return countPaidOrdersByCustomer(customerId);
}
