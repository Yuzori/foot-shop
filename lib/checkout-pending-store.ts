import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import type { CreateOrderLine } from "@/services/prestashop";

const PENDING_DIR = path.join(process.cwd(), ".data", "checkout-pending");
const INDEX_FILE = path.join(PENDING_DIR, "_index.json");

export interface CheckoutPendingRecord {
  id: string;
  reference: string;
  orderId: string;
  customerId: string;
  createdAt: string;
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  address: {
    address1: string;
    address2?: string;
    postcode: string;
    city: string;
    country: string;
  };
  lines: CreateOrderLine[];
  subtotal: number;
  shippingFee: number;
  promoCode: string | null;
  promoDiscount: number;
  bogoDiscount: number;
  bogoApplied: boolean;
  total: number;
  currency: string;
  note?: string;
  stripeSessionId?: string | null;
}

async function readIndex(): Promise<CheckoutPendingRecord[]> {
  try {
    const raw = await fs.readFile(INDEX_FILE, "utf8");
    const parsed = JSON.parse(raw) as CheckoutPendingRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIndex(records: CheckoutPendingRecord[]): Promise<void> {
  await fs.mkdir(PENDING_DIR, { recursive: true });
  await fs.writeFile(INDEX_FILE, JSON.stringify(records, null, 2), "utf8");
}

function fileFor(id: string): string {
  const safe = id.replace(/[^\w-]/g, "");
  return path.join(PENDING_DIR, `${safe}.json`);
}

export async function saveCheckoutPending(
  record: CheckoutPendingRecord,
): Promise<void> {
  await fs.mkdir(PENDING_DIR, { recursive: true });
  await fs.writeFile(fileFor(record.id), JSON.stringify(record, null, 2), "utf8");

  const index = await readIndex();
  const existing = index.findIndex((item) => item.id === record.id);
  if (existing >= 0) {
    index[existing] = record;
  } else {
    index.unshift(record);
  }
  await writeIndex(index);
}

export async function getCheckoutPendingByReference(
  reference: string,
): Promise<CheckoutPendingRecord | null> {
  const ref = reference.trim();
  if (!ref) return null;
  const index = await readIndex();
  const hit = index.find((item) => item.reference === ref);
  if (!hit) return null;
  try {
    const raw = await fs.readFile(fileFor(hit.id), "utf8");
    return JSON.parse(raw) as CheckoutPendingRecord;
  } catch {
    return null;
  }
}

export async function attachStripeSessionToPending(
  reference: string,
  stripeSessionId: string,
): Promise<void> {
  const pending = await getCheckoutPendingByReference(reference);
  if (!pending) return;
  pending.stripeSessionId = stripeSessionId;
  await saveCheckoutPending(pending);
}

export async function deleteCheckoutPending(reference: string): Promise<void> {
  const ref = reference.trim();
  if (!ref) return;
  const index = await readIndex();
  const hit = index.find((item) => item.reference === ref);
  if (!hit) return;
  await fs.rm(fileFor(hit.id), { force: true });
  await writeIndex(index.filter((item) => item.reference !== ref));
}
