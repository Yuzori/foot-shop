import "server-only";

import { paymentConfig } from "@/config/payment";
import { firstOrderThankYouPromo } from "@/config/promotions";
import { countPaidOrdersByCustomer } from "@/lib/customer-order-history";
import { backupFromArchive } from "@/lib/order-backup-store";
import {
  getOrderArchiveByReference,
  markOrderArchivePaid,
  markOrderArchiveStockReserved,
} from "@/lib/order-archive-store";
import { sendOrderConfirmationEmail } from "@/lib/order-confirmation-email";
import { sendShippingPendingEmail } from "@/lib/shipping-pending-email";
import { notifySupplierOfOrder } from "@/lib/supplier-order";
import { claimOrderFulfillment } from "@/lib/order-fulfillment-store";
import { resolveCheckoutNotificationEmail } from "@/lib/checkout-notification-email";
import { prestashop } from "@/services/prestashop";

/** Marque une commande payée, envoie l'email client et notifie le fournisseur. */
export async function fulfillPaidOrder(
  orderId: string,
  customerEmail?: string | null,
): Promise<void> {
  const key = orderId.trim();
  if (!key) return;

  if (!(await claimOrderFulfillment(key))) return;

  const order = await prestashop.getOrderById(key);
  if (!order) {
    throw new Error(`Commande PrestaShop introuvable (id ${key}).`);
  }

  const archive = await getOrderArchiveByReference(order.reference);
  if (archive?.stockReserved === false) {
    const ctx = await prestashop.getSupplierOrderContext(key);
    if (ctx?.lines.length) {
      await prestashop.decrementStockForLines(
        ctx.lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
          unitPrice: 0,
          name: line.name,
        })),
      );
      await markOrderArchiveStockReserved(order.reference);
    }
  }

  const history = await prestashop.addOrderHistory(key, paymentConfig.paidStateId);
  if (!history.ok) {
    console.warn("[order-paid] addOrderHistory failed", key, history.error);
  }

  const email = resolveCheckoutNotificationEmail({
    archive,
    checkoutEmail: customerEmail,
    fallbackEmail: await prestashop.getCustomerEmailByOrderId(key),
  });

  const paidAt = new Date().toISOString();
  await markOrderArchivePaid(order.reference, paidAt).catch((err) => {
    console.error("[order-paid] archive update failed", err);
  });

  const paidArchive = await getOrderArchiveByReference(order.reference);
  if (paidArchive) {
    await backupFromArchive("paid", paidArchive, { status: "paid" }).catch((err) => {
      console.error("[order-paid] backup failed", err);
    });
  }

  const customerId = email
    ? (await prestashop.getCustomerAuthByEmail(email))?.id ?? null
    : null;
  let isFirstPaidOrder = false;
  if (customerId) {
    const paidCount = await countPaidOrdersByCustomer(customerId);
    isFirstPaidOrder = paidCount <= 1;
  } else if (email) {
    isFirstPaidOrder = true;
  }

  const firstName = archive?.contact.firstName;

  await Promise.all([
    email
      ? sendOrderConfirmationEmail({
          to: email,
          order,
          firstName,
          firstOrderPromo: isFirstPaidOrder
            ? {
                code: firstOrderThankYouPromo.code,
                percent: firstOrderThankYouPromo.percent,
              }
            : undefined,
        }).catch((err) => {
          console.error("[order-paid] confirmation email failed", key, err);
        })
      : Promise.resolve(),
    email
      ? sendShippingPendingEmail({
          to: email,
          reference: order.reference,
        }).catch((err) => {
          console.error("[order-paid] shipping pending email failed", key, err);
        })
      : Promise.resolve(),
    notifySupplierOfOrder(order, key).catch((err) => {
      console.error("[order-paid] supplier notify failed", key, err);
    }),
  ]);
}
