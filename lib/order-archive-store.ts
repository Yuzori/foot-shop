import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import type { CreateOrderLine } from "@/services/prestashop";

const ARCHIVE_DIR = path.join(process.cwd(), ".data", "order-archives");
const INDEX_FILE = path.join(ARCHIVE_DIR, "_index.json");

export interface OrderArchiveRecord {
  id: string;
  reference: string;
  orderId: string | null;
  customerId: string | null;
  createdAt: string;
  paidAt: string | null;
  status: "created" | "paid" | "test";
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
  total: number;
  currency: string;
  note?: string;
  stripeSessionId?: string | null;
  source: "checkout" | "stripe" | "admin_test";
}

async function readIndex(): Promise<OrderArchiveRecord[]> {
  try {
    const raw = await fs.readFile(INDEX_FILE, "utf8");
    const parsed = JSON.parse(raw) as OrderArchiveRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIndex(records: OrderArchiveRecord[]): Promise<void> {
  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
  await fs.writeFile(INDEX_FILE, JSON.stringify(records, null, 2), "utf8");
}

function fileFor(id: string): string {
  const safe = id.replace(/[^\w-]/g, "");
  return path.join(ARCHIVE_DIR, `${safe}.json`);
}

export async function archiveOrder(record: OrderArchiveRecord): Promise<void> {
  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
  await fs.writeFile(fileFor(record.id), JSON.stringify(record, null, 2), "utf8");

  const index = await readIndex();
  const existing = index.findIndex((r) => r.id === record.id);
  if (existing >= 0) {
    index[existing] = record;
  } else {
    index.unshift(record);
  }
  await writeIndex(index);
}

export async function markOrderArchivePaid(
  reference: string,
  paidAt: string,
): Promise<void> {
  const index = await readIndex();
  const hit = index.find((r) => r.reference === reference);
  if (!hit) return;
  hit.paidAt = paidAt;
  hit.status = hit.status === "test" ? "test" : "paid";
  await writeIndex(index);
  await fs.writeFile(fileFor(hit.id), JSON.stringify(hit, null, 2), "utf8");
}

export async function listOrderArchives(limit = 500): Promise<OrderArchiveRecord[]> {
  const index = await readIndex();
  return index.slice(0, limit);
}

export async function getOrderArchive(id: string): Promise<OrderArchiveRecord | null> {
  try {
    const raw = await fs.readFile(fileFor(id), "utf8");
    return JSON.parse(raw) as OrderArchiveRecord;
  } catch {
    return null;
  }
}
