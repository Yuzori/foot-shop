import "server-only";

import { paymentConfig } from "@/config/payment";
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
import {
  ensureSupplierDraftFromArchiveReference,
  ensureSupplierOrderDraftForOrder,
} from "@/lib/ensure-supplier-draft";
import { ensurePrestaShopOrderPaid } from "@/lib/mark-prestashop-order-paid";
import { sendPaidOrderCustomerEmailsIfNeeded } from "@/lib/send-paid-order-customer-emails";
import {
  claimOrderFulfillment,
  hasOrderBeenFulfilled,
  releaseOrderFulfillmentClaim,
} from "@/lib/order-fulfillment-store";
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
  const key = String(orderId).trim();
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

  const alreadyFulfilled = await hasOrderBeenFulfilled(key);
  const claimed = alreadyFulfilled ? false : await claimOrderFulfillment(key);

  const psMarkedPaid = await ensurePrestaShopOrderPaid(key);
  if (!psMarkedPaid) {
    console.error("[order-paid] PrestaShop paid state failed", key);
    if (claimed) {
      await releaseOrderFulfillmentClaim(key).catch(() => {});
    }
    throw new Error(
      `Impossible de marquer la commande ${order.reference} comme payée dans PrestaShop.`,
    );
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
  }

  await sendPaidOrderCustomerEmailsIfNeeded({
    order,
    orderId: key,
    archive,
    checkoutEmail: customerEmail,
  }).catch((err) => {
    console.error("[order-paid] customer emails failed", key, err);
  });

  try {
    await ensureSupplierOrderDraftForOrder(order, key);
  } catch (err) {
    console.error("[order-paid] supplier draft failed", key, err);
    await ensureSupplierDraftFromArchiveReference(order.reference).catch((fallbackErr) => {
      console.error("[order-paid] supplier archive fallback failed", key, fallbackErr);
    });
  }
}
