import "server-only";

import { paymentConfig } from "@/config/payment";
import { firstOrderThankYouPromo } from "@/config/promotions";
import { countPaidOrdersByCustomer } from "@/lib/customer-order-history";
import { backupFromArchive } from "@/lib/order-backup-store";
import {
  archiveOrder,
  getOrderArchiveByReference,
  markOrderArchivePaid,
  markOrderArchiveStockReserved,
  type OrderArchiveRecord,
} from "@/lib/order-archive-store";
import {
  deleteCheckoutPending,
  getCheckoutPendingByReference,
  type CheckoutPendingRecord,
} from "@/lib/checkout-pending-store";
import { sendOrderConfirmationEmail } from "@/lib/order-confirmation-email";
import { sendShippingPendingEmail } from "@/lib/shipping-pending-email";
import {
  ensureSupplierDraftFromArchiveReference,
  ensureSupplierOrderDraftForOrder,
} from "@/lib/ensure-supplier-draft";
import {
  claimOrderFulfillment,
  hasOrderBeenFulfilled,
} from "@/lib/order-fulfillment-store";
import { resolveCheckoutNotificationEmail } from "@/lib/checkout-notification-email";
import { rebuildArchiveFromPrestaShopOrder } from "@/lib/rebuild-order-archive";
import { assertStripePaymentForOrder } from "@/lib/stripe-payment-guard";
import { prestashop } from "@/services/prestashop";
import type { Order } from "@/types/domain";

function materializePaidArchive(
  order: Order,
  pending: CheckoutPendingRecord,
  stripeSessionId?: string | null,
): OrderArchiveRecord {
  return {
    id: pending.id,
    reference: pending.reference,
    orderId: pending.orderId || order.id,
    customerId: pending.customerId,
    createdAt: pending.createdAt,
    paidAt: new Date().toISOString(),
    status: "paid",
    contact: pending.contact,
    address: pending.address,
    lines: pending.lines,
    subtotal: pending.subtotal,
    shippingFee: pending.shippingFee,
    promoCode: pending.promoCode,
    promoDiscount: pending.promoDiscount,
    total: pending.total,
    currency: pending.currency,
    note: pending.note,
    stripeSessionId: stripeSessionId ?? pending.stripeSessionId ?? null,
    source: "stripe",
    stockReserved: false,
  };
}

/** Archive payée : depuis pending (nouveau flux) ou marquage d'une archive legacy. */
async function ensurePaidArchiveExists(
  order: Order,
  stripeSessionId?: string | null,
): Promise<OrderArchiveRecord | null> {
  let archive = await getOrderArchiveByReference(order.reference);
  if (archive && (archive.status === "paid" || archive.paidAt)) {
    return archive;
  }

  const pending = await getCheckoutPendingByReference(order.reference);
  const paidAt = new Date().toISOString();

  if (!archive && pending) {
    archive = materializePaidArchive(order, pending, stripeSessionId);
    await archiveOrder(archive);
    await backupFromArchive("paid", archive, { status: "paid" }).catch((err) => {
      console.error("[order-paid] backup failed", err);
    });
    await deleteCheckoutPending(order.reference);
    return archive;
  }

  if (archive && archive.status === "created") {
    await markOrderArchivePaid(order.reference, paidAt);
    archive = await getOrderArchiveByReference(order.reference);
    if (archive) {
      await backupFromArchive("paid", archive, { status: "paid" }).catch((err) => {
        console.error("[order-paid] backup failed", err);
      });
    }
  }

  if (!archive || (!archive.paidAt && archive.status !== "paid")) {
    archive = await rebuildArchiveFromPrestaShopOrder(order.id).catch((err) => {
      console.error("[order-paid] rebuild archive failed", order.reference, err);
      return null;
    });
  }

  return archive;
}

/** Marque une commande payée, envoie l'email client et notifie le fournisseur. */
export async function fulfillPaidOrder(
  orderId: string,
  customerEmail?: string | null,
  options?: { checkoutSessionId?: string | null },
): Promise<void> {
  const key = orderId.trim();
  if (!key) return;

  const order = await prestashop.getOrderById(key);
  if (!order) {
    throw new Error(`Commande PrestaShop introuvable (id ${key}).`);
  }

  await assertStripePaymentForOrder({
    orderId: key,
    reference: order.reference,
    checkoutSessionId: options?.checkoutSessionId,
  });

  const archive = await ensurePaidArchiveExists(order, options?.checkoutSessionId);

  const claimed = await claimOrderFulfillment(key);
  const alreadyFulfilled = !claimed && (await hasOrderBeenFulfilled(key));

  if (!claimed && !alreadyFulfilled) {
    console.warn("[order-paid] fulfillment claim failed", key);
  }

  if (claimed) {
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
    ]);
  }

  try {
    await ensureSupplierOrderDraftForOrder(order, key);
  } catch (err) {
    console.error("[order-paid] supplier draft failed", key, err);
    await ensureSupplierDraftFromArchiveReference(order.reference).catch((fallbackErr) => {
      console.error("[order-paid] supplier archive fallback failed", key, fallbackErr);
    });
  }
}
