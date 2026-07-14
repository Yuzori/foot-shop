import "server-only";

import { paymentConfig } from "@/config/payment";
import { markOrderArchivePaid } from "@/lib/order-archive-store";
import { sendFirstOrderThankYouEmail } from "@/lib/first-order-thank-you-email";
import { sendOrderConfirmationEmail } from "@/lib/order-confirmation-email";
import { notifySupplierOfOrder } from "@/lib/supplier-order";
import {
  hasOrderBeenFulfilled,
  markOrderFulfilled,
} from "@/lib/order-fulfillment-store";
import { prestashop } from "@/services/prestashop";

/** Marque une commande payée, envoie l'email client et notifie le fournisseur. */
export async function fulfillPaidOrder(
  orderId: string,
  customerEmail?: string | null,
): Promise<void> {
  const key = orderId.trim();
  if (!key) return;

  if (await hasOrderBeenFulfilled(key)) return;

  const order = await prestashop.getOrderById(key);
  if (!order) {
    throw new Error(`Commande PrestaShop introuvable (id ${key}).`);
  }

  const history = await prestashop.addOrderHistory(key, paymentConfig.paidStateId);
  if (!history.ok) {
    console.warn("[order-paid] addOrderHistory failed", key, history.error);
  }

  const email =
    customerEmail?.trim() || (await prestashop.getCustomerEmailByOrderId(key));

  const paidAt = new Date().toISOString();
  await markOrderArchivePaid(order.reference, paidAt).catch((err) => {
    console.error("[order-paid] archive update failed", err);
  });

  const customerId = email
    ? (await prestashop.getCustomerAuthByEmail(email))?.id ?? null
    : null;
  let isFirstPaidOrder = false;
  if (customerId) {
    const prior = await prestashop.getOrdersByCustomer(customerId);
    isFirstPaidOrder = prior.length <= 1;
  } else if (email) {
    isFirstPaidOrder = true;
  }

  await Promise.all([
    email
      ? sendOrderConfirmationEmail({ to: email, order }).catch((err) => {
          console.error("[order-paid] confirmation email failed", key, err);
        })
      : Promise.resolve(),
    email && isFirstPaidOrder
      ? sendFirstOrderThankYouEmail({
          to: email,
          reference: order.reference,
        }).catch((err) => {
          console.error("[order-paid] thank-you email failed", key, err);
        })
      : Promise.resolve(),
    notifySupplierOfOrder(order, key).catch((err) => {
      console.error("[order-paid] supplier notify failed", key, err);
    }),
  ]);

  await markOrderFulfilled(key);
}
