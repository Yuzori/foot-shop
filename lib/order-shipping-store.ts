import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

export interface OrderShippingInfo {
  reference: string;
  trackingNumber: string;
  carrierUrl: string;
  customerEmail: string | null;
  sentAt: string | null;
  updatedAt: string;
}

const FILE = path.join(process.cwd(), ".data", "order-shipping.json");

async function readAll(): Promise<OrderShippingInfo[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const data = JSON.parse(raw) as OrderShippingInfo[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeAll(items: OrderShippingInfo[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

export async function getOrderShipping(
  reference: string,
): Promise<OrderShippingInfo | null> {
  const key = reference.trim().toUpperCase();
  if (!key) return null;
  const items = await readAll();
  return items.find((i) => i.reference.toUpperCase() === key) ?? null;
}

export async function upsertOrderShipping(
  input: Omit<OrderShippingInfo, "updatedAt" | "sentAt"> & {
    sentAt?: string | null;
  },
): Promise<OrderShippingInfo> {
  const key = input.reference.trim().toUpperCase();
  const items = await readAll();
  const now = new Date().toISOString();
  const existing = items.find((i) => i.reference.toUpperCase() === key);
  const next: OrderShippingInfo = {
    reference: key,
    trackingNumber: input.trackingNumber.trim(),
    carrierUrl: input.carrierUrl.trim(),
    customerEmail: input.customerEmail?.trim().toLowerCase() || null,
    sentAt: input.sentAt ?? existing?.sentAt ?? null,
    updatedAt: now,
  };
  const filtered = items.filter((i) => i.reference.toUpperCase() !== key);
  filtered.push(next);
  await writeAll(filtered);
  return next;
}

export async function markShippingEmailSent(reference: string): Promise<void> {
  const key = reference.trim().toUpperCase();
  const items = await readAll();
  const idx = items.findIndex((i) => i.reference.toUpperCase() === key);
  const item = items[idx];
  if (!item) return;
  items[idx] = {
    ...item,
    sentAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await writeAll(items);
}

export async function listOrderShipping(): Promise<OrderShippingInfo[]> {
  const items = await readAll();
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
