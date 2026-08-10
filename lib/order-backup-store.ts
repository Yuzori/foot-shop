import "server-only";

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { CreateOrderLine } from "@/services/prestashop";

import type { OrderArchiveRecord } from "@/lib/order-archive-store";

const BACKUP_DIR = path.join(process.cwd(), ".data", "order-backups");
const LEDGER_FILE = path.join(BACKUP_DIR, "ledger.jsonl");

export type OrderBackupEvent = "created" | "paid" | "shipping_updated";

export interface OrderBackupEntry {
  id: string;
  event: OrderBackupEvent;
  at: string;
  reference: string;
  orderId: string | null;
  customerId: string | null;
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
  status?: string;
  trackingNumber?: string;
  carrierUrl?: string;
}

async function secureDir(): Promise<void> {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  try {
    await fs.chmod(BACKUP_DIR, 0o700);
  } catch {
    /* Windows */
  }
}

async function appendEntry(entry: OrderBackupEntry): Promise<void> {
  await secureDir();
  const line = `${JSON.stringify(entry)}\n`;
  await fs.appendFile(LEDGER_FILE, line, "utf8");
  try {
    await fs.chmod(LEDGER_FILE, 0o600);
  } catch {
    /* Windows */
  }
}

function buildEntry(
  event: OrderBackupEvent,
  data: Omit<OrderBackupEntry, "id" | "event" | "at">,
): OrderBackupEntry {
  return {
    id: `bkp-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    event,
    at: new Date().toISOString(),
    ...data,
  };
}

/** Journal append-only : sauvegarde temps réel de chaque commande client. */
export async function backupOrderSnapshot(
  event: OrderBackupEvent,
  data: Omit<OrderBackupEntry, "id" | "event" | "at">,
): Promise<void> {
  await appendEntry(buildEntry(event, data));
}

export async function backupFromArchive(
  event: OrderBackupEvent,
  record: OrderArchiveRecord,
  extra?: Pick<OrderBackupEntry, "trackingNumber" | "carrierUrl" | "status">,
): Promise<void> {
  await backupOrderSnapshot(event, {
    reference: record.reference,
    orderId: record.orderId,
    customerId: record.customerId,
    contact: record.contact,
    address: record.address,
    lines: record.lines,
    subtotal: record.subtotal,
    shippingFee: record.shippingFee,
    promoCode: record.promoCode,
    promoDiscount: record.promoDiscount,
    total: record.total,
    currency: record.currency,
    note: record.note,
    stripeSessionId: record.stripeSessionId,
    status: extra?.status ?? record.status,
    trackingNumber: extra?.trackingNumber,
    carrierUrl: extra?.carrierUrl,
  });
}

export async function listRecentOrderBackups(
  limit = 100,
): Promise<OrderBackupEntry[]> {
  try {
    const raw = await fs.readFile(LEDGER_FILE, "utf8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines
      .slice(-limit)
      .map((line) => JSON.parse(line) as OrderBackupEntry)
      .reverse();
  } catch {
    return [];
  }
}

export async function countOrderBackups(): Promise<number> {
  try {
    const raw = await fs.readFile(LEDGER_FILE, "utf8");
    return raw.trim().split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}
