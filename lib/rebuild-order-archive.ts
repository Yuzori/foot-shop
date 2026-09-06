import "server-only";

import crypto from "node:crypto";

import { backupFromArchive } from "@/lib/order-backup-store";
import {
  archiveOrder,
  getOrderArchiveByReference,
  type OrderArchiveRecord,
} from "@/lib/order-archive-store";
import { prestashop } from "@/services/prestashop";
import type { CreateOrderLine } from "@/services/prestashop";
import type { Order } from "@/types/domain";
export async function rebuildArchiveFromPrestaShopOrder(
  orderId: string,
): Promise<OrderArchiveRecord | null> {
  const key = orderId.trim();
  if (!key) return null;

  const order = await prestashop.getOrderById(key);
  if (!order?.reference) return null;

  const existing = await getOrderArchiveByReference(order.reference);
  if (existing && (existing.status === "paid" || existing.paidAt)) {
    return existing;
  }

  const context = await prestashop.getSupplierOrderContext(key);
  if (!context?.lines.length) return null;

  const lines: CreateOrderLine[] = context.lines.map((line) => {
    const priced =
      order.lines.find(
        (row) =>
          row.productId === line.productId &&
          (row.name === line.name || !line.name),
      ) ?? order.lines.find((row) => row.productId === line.productId);
    return {
      productId: line.productId,
      variantId: line.variantId,
      name: line.name,
      quantity: line.quantity,
      unitPrice: priced?.unitPrice ?? 0,
    };
  });

  const subtotal = lines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  const shippingFee = Math.max(0, order.total - subtotal);
  const customerId = await prestashop.getOrderCustomerId(key);

  const record: OrderArchiveRecord = {
    id: `ord-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    reference: order.reference,
    orderId: order.id,
    customerId,
    createdAt: order.createdAt ?? new Date().toISOString(),
    paidAt: order.createdAt ?? new Date().toISOString(),
    status: "paid",
    contact: {
      firstName: context.delivery.firstName || "Client",
      lastName: context.delivery.lastName || "Client",
      email: context.customerEmail ?? "",
      phone: context.delivery.phone || undefined,
    },
    address: {
      address1: context.delivery.address1,
      address2: context.delivery.address2 || undefined,
      postcode: context.delivery.postcode,
      city: context.delivery.city,
      country: context.delivery.country || "France",
    },
    lines,
    subtotal,
    shippingFee,
    promoCode: null,
    promoDiscount: 0,
    total: order.total,
    currency: order.currency || "EUR",
    note: context.flocageNote ?? undefined,
    stripeSessionId: null,
    source: "stripe",
    stockReserved: true,
  };

  await archiveOrder(record);
  await backupFromArchive("paid", record, { status: "paid" }).catch((err) => {
    console.error("[rebuild-archive] backup failed", order.reference, err);
  });

  return record;
}

/** Archive depuis un objet Order déjà chargé (sans requête PS complète). */
export async function rebuildArchiveFromOrder(order: Order): Promise<OrderArchiveRecord | null> {
  return rebuildArchiveFromPrestaShopOrder(order.id);
}
