import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { paymentConfig } from "@/config/payment";
import {
  listCheckoutAbandonRecords,
  type CheckoutAbandonRecord,
} from "@/lib/checkout-abandons-store";
import { clearCheckoutPendingStore } from "@/lib/checkout-pending-store";
import { clearCheckoutAbandonsStore } from "@/lib/checkout-abandons-store";
import {
  ensureAbandonsResetV2,
  getAbandonsCutoffIso,
} from "@/lib/abandons-cutoff";
import {
  inferAbandonCauseFromStripeSession,
  parseStripeOrderLinesFromMetadata,
} from "@/lib/stripe-order-metadata";
import { getStripe } from "@/lib/stripe-server";
import type {
  AbandonedCheckout,
  StripeAdminOrder,
  StripeAdminOrdersResponse,
} from "@/lib/stripe-admin-types";

function isSessionPaid(session: {
  payment_status?: string | null;
  status?: string | null;
}): boolean {
  return (
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required" ||
    session.status === "complete"
  );
}

const MIGRATION_MARKER = path.join(process.cwd(), ".data", "stripe-admin-v1.migrated");
const ABANDON_OPEN_MINUTES = 10;
const SESSION_PAGES = 8;

function stripeDashboardUrl(sessionId: string): string {
  return `https://dashboard.stripe.com/checkout/sessions/${sessionId}`;
}

type StripeAddress = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

function formatStripeAddress(address: StripeAddress | null | undefined): string {
  if (!address) return "";
  return [
    address.line1,
    address.line2,
    `${address.postal_code ?? ""} ${address.city ?? ""}`.trim(),
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function extractSessionContactDetails(session: {
  metadata: Record<string, string> | null;
  customer_email: string | null;
  customer_details?: {
    email?: string | null;
    phone?: string | null;
    name?: string | null;
    address?: StripeAddress | null;
  } | null;
  shipping_details?: {
    name?: string | null;
    address?: StripeAddress | null;
  } | null;
}): {
  customerName: string;
  email: string;
  phone: string;
  shippingAddress: string;
} {
  const metadata = session.metadata ?? {};
  const customerDetails = session.customer_details;
  const shippingDetails = session.shipping_details;

  const phone =
    metadata.customerPhone?.trim() ||
    metadata.phone?.trim() ||
    customerDetails?.phone?.trim() ||
    "";
  const shippingAddress =
    metadata.shippingAddress?.trim() ||
    metadata.address?.trim() ||
    formatStripeAddress(shippingDetails?.address ?? customerDetails?.address);
  const customerName =
    metadata.shippingName?.trim() ||
    shippingDetails?.name?.trim() ||
    customerDetails?.name?.trim() ||
    "Client";
  const email =
    metadata.customerEmail?.trim() ||
    session.customer_email?.trim() ||
    customerDetails?.email?.trim() ||
    "";

  return { customerName, email, phone, shippingAddress };
}

function readSessionShippingDetails(session: unknown): {
  name?: string | null;
  address?: StripeAddress | null;
} | null {
  if (!session || typeof session !== "object") return null;
  const details = (session as { shipping_details?: { name?: string | null; address?: StripeAddress | null } | null })
    .shipping_details;
  return details ?? null;
}

function mapAbandonRecord(record: CheckoutAbandonRecord): AbandonedCheckout {
  return {
    reference: record.reference,
    sessionId: record.sessionId,
    createdAt: record.createdAt,
    cause: record.cause,
    customerName: record.customerName,
    email: record.email,
    phone: record.phone,
    total: record.total,
    currency: record.currency,
    lines: record.lines,
  };
}

function mapStripeSessionToOrder(session: {
  id: string;
  created: number;
  amount_total: number | null;
  currency: string | null;
  metadata: Record<string, string> | null;
  customer_email: string | null;
  customer_details?: {
    email?: string | null;
    phone?: string | null;
    name?: string | null;
    address?: StripeAddress | null;
  } | null;
  shipping_details?: {
    name?: string | null;
    address?: StripeAddress | null;
  } | null;
}): StripeAdminOrder | null {
  const metadata = session.metadata ?? {};
  const reference = metadata.reference?.trim();
  if (!reference) return null;

  const contact = extractSessionContactDetails(session);
  const lines = parseStripeOrderLinesFromMetadata(metadata);
  const amount = (session.amount_total ?? 0) / 100;

  return {
    sessionId: session.id,
    reference,
    orderId: metadata.orderId?.trim() || "",
    customerId: metadata.customerId?.trim() || "",
    customerName: contact.customerName,
    email: contact.email,
    phone: contact.phone,
    shippingAddress: contact.shippingAddress,
    lines,
    amount,
    currency: (session.currency ?? "eur").toUpperCase(),
    paidAt: new Date((session.created ?? 0) * 1000).toISOString(),
    stripeUrl: stripeDashboardUrl(session.id),
  };
}

function mapStripeSessionToAbandon(
  session: {
    id: string;
    created: number;
    amount_total: number | null;
    currency: string | null;
    status: string | null;
    payment_status: string | null;
    metadata: Record<string, string> | null;
    customer_email: string | null;
    customer_details?: {
      email?: string | null;
      phone?: string | null;
      name?: string | null;
      address?: StripeAddress | null;
    } | null;
    shipping_details?: {
      name?: string | null;
      address?: StripeAddress | null;
    } | null;
  },
  cutoffMs: number,
): AbandonedCheckout | null {
  if (isSessionPaid(session)) return null;

  const createdAt = new Date((session.created ?? 0) * 1000);
  if (createdAt.getTime() < cutoffMs) return null;
  const ageMinutes = (Date.now() - createdAt.getTime()) / (60 * 1000);

  const metadata = session.metadata ?? {};
  const reference = metadata.reference?.trim();
  if (!reference) return null;

  if (session.status === "open" && session.payment_status === "unpaid") {
    if (ageMinutes < ABANDON_OPEN_MINUTES) return null;
  } else if (session.status !== "expired") {
    return null;
  }

  const lines = parseStripeOrderLinesFromMetadata(metadata);
  const total = (session.amount_total ?? 0) / 100;
  const contact = extractSessionContactDetails(session);

  return {
    reference,
    sessionId: session.id,
    createdAt: createdAt.toISOString(),
    cause: inferAbandonCauseFromStripeSession({
      status: session.status,
      paymentStatus: session.payment_status,
    }),
    customerName: contact.customerName === "Client" ? "User" : contact.customerName,
    email: contact.email,
    phone: contact.phone,
    total,
    currency: (session.currency ?? "eur").toUpperCase(),
    lines,
  };
}

/** Reset historique abandons PrestaShop (migration vers Stripe). */
export async function ensureStripeAdminMigration(): Promise<void> {
  try {
    await fs.access(MIGRATION_MARKER);
    return;
  } catch {
    await clearCheckoutPendingStore();
    await clearCheckoutAbandonsStore();
    await fs.mkdir(path.dirname(MIGRATION_MARKER), { recursive: true });
    await fs.writeFile(
      MIGRATION_MARKER,
      JSON.stringify({ migratedAt: new Date().toISOString() }, null, 2),
      "utf8",
    );
  }
}

export async function listStripeAdminOrders(limit = 50): Promise<StripeAdminOrdersResponse> {
  if (!paymentConfig.stripeEnabled) {
    return { orders: [], abandoned: [], updatedAt: new Date().toISOString() };
  }

  await ensureStripeAdminMigration();
  await ensureAbandonsResetV2();

  const cutoffIso = await getAbandonsCutoffIso();
  const cutoffMs = new Date(cutoffIso).getTime();

  const stripe = getStripe();
  const orders: StripeAdminOrder[] = [];
  const abandonedFromStripe: AbandonedCheckout[] = [];
  const seenOrderRefs = new Set<string>();
  const seenAbandonRefs = new Set<string>();

  let startingAfter: string | undefined;
  for (let page = 0; page < SESSION_PAGES; page++) {
    const batch = await stripe.checkout.sessions.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const session of batch.data) {
      const metadata = (session.metadata ?? {}) as Record<string, string>;

      if (isSessionPaid(session)) {
        const order = mapStripeSessionToOrder({
          id: session.id,
          created: session.created,
          amount_total: session.amount_total,
          currency: session.currency,
          metadata,
          customer_email: session.customer_email,
          customer_details: session.customer_details,
          shipping_details: readSessionShippingDetails(session),
        });
        if (order && !seenOrderRefs.has(order.reference)) {
          seenOrderRefs.add(order.reference);
          orders.push(order);
        }
        continue;
      }

      const abandon = mapStripeSessionToAbandon(
        {
          id: session.id,
          created: session.created,
          amount_total: session.amount_total,
          currency: session.currency,
          status: session.status,
          payment_status: session.payment_status,
          metadata,
          customer_email: session.customer_email,
          customer_details: session.customer_details,
          shipping_details: readSessionShippingDetails(session),
        },
        cutoffMs,
      );
      if (abandon && !seenAbandonRefs.has(abandon.reference)) {
        seenAbandonRefs.add(abandon.reference);
        abandonedFromStripe.push(abandon);
      }
    }

    if (!batch.has_more || batch.data.length === 0) break;
    startingAfter = batch.data[batch.data.length - 1]?.id;
  }

  orders.sort((a, b) => b.paidAt.localeCompare(a.paidAt));

  const localAbandons = (await listCheckoutAbandonRecords()).map(mapAbandonRecord);
  const abandonedMap = new Map<string, AbandonedCheckout>();

  for (const item of [...abandonedFromStripe, ...localAbandons]) {
    if (seenOrderRefs.has(item.reference)) continue;
    if (new Date(item.createdAt).getTime() < cutoffMs) continue;
    const existing = abandonedMap.get(item.reference);
    if (!existing || item.createdAt > existing.createdAt) {
      abandonedMap.set(item.reference, item);
    }
  }

  const abandoned = [...abandonedMap.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);

  return {
    orders: orders.slice(0, limit),
    abandoned,
    updatedAt: new Date().toISOString(),
  };
}

export { resetAbandonsCutoff } from "@/lib/abandons-cutoff";
export type { StripeAdminOrder, AbandonedCheckout } from "@/lib/stripe-admin-types";
