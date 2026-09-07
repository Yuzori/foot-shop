import "server-only";

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { StripeOrderLine } from "@/lib/stripe-admin-types";

const FILE = path.join(process.cwd(), ".data", "checkout-abandons.json");

export type CheckoutAbandonRecord = {
  id: string;
  reference: string;
  sessionId: string | null;
  createdAt: string;
  cause: string;
  customerName: string;
  email: string;
  phone: string;
  total: number;
  currency: string;
  lines: StripeOrderLine[];
};

type StoreFile = {
  v: 1;
  records: CheckoutAbandonRecord[];
};

async function readStore(): Promise<StoreFile> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as StoreFile;
    if (parsed?.v === 1 && Array.isArray(parsed.records)) return parsed;
  } catch {
    /* fresh store */
  }
  return { v: 1, records: [] };
}

async function writeStore(store: StoreFile): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function clearCheckoutAbandonsStore(): Promise<void> {
  await writeStore({ v: 1, records: [] });
}

export async function listCheckoutAbandonRecords(): Promise<CheckoutAbandonRecord[]> {
  const store = await readStore();
  return store.records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function removeCheckoutAbandonByReference(reference: string): Promise<void> {
  const ref = reference.trim();
  if (!ref) return;
  const store = await readStore();
  store.records = store.records.filter((item) => item.reference !== ref);
  await writeStore(store);
}

export async function recordCheckoutAbandon(
  record: Omit<CheckoutAbandonRecord, "id"> & { id?: string },
): Promise<void> {
  const ref = record.reference.trim();
  if (!ref) return;

  const store = await readStore();
  const existing = store.records.find(
    (item) => item.reference === ref || (record.sessionId && item.sessionId === record.sessionId),
  );
  if (existing) {
    existing.cause = record.cause;
    existing.createdAt = record.createdAt;
    existing.lines = record.lines;
    existing.total = record.total;
    existing.customerName = record.customerName;
    existing.email = record.email;
    existing.phone = record.phone;
    if (record.sessionId) existing.sessionId = record.sessionId;
    await writeStore(store);
    return;
  }

  store.records.unshift({
    ...record,
    id: record.id ?? crypto.randomUUID(),
    reference: ref,
  });
  await writeStore(store);
}
