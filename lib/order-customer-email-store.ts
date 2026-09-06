import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), ".data", "customer-emails-sent.json");

interface EmailSentStore {
  orderIds: string[];
}

async function readStore(): Promise<EmailSentStore> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const data = JSON.parse(raw) as EmailSentStore;
    return { orderIds: Array.isArray(data.orderIds) ? data.orderIds : [] };
  } catch {
    return { orderIds: [] };
  }
}

async function writeStore(store: EmailSentStore): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function hasOrderCustomerEmailsBeenSent(
  orderId: string,
): Promise<boolean> {
  const key = orderId.trim();
  if (!key) return false;
  const store = await readStore();
  return store.orderIds.includes(key);
}

/** Réserve l'envoi (anti-doublon). Retire avec releaseOrderCustomerEmailsClaim si l'envoi échoue. */
export async function claimOrderCustomerEmails(orderId: string): Promise<boolean> {
  const key = orderId.trim();
  if (!key) return false;

  const store = await readStore();
  if (store.orderIds.includes(key)) return false;
  store.orderIds.push(key);
  await writeStore(store);
  return true;
}

export async function markOrderCustomerEmailsSent(orderId: string): Promise<void> {
  const key = orderId.trim();
  if (!key) return;
  const store = await readStore();
  if (store.orderIds.includes(key)) return;
  store.orderIds.push(key);
  await writeStore(store);
}

export async function releaseOrderCustomerEmailsClaim(orderId: string): Promise<void> {
  const key = orderId.trim();
  if (!key) return;
  const store = await readStore();
  store.orderIds = store.orderIds.filter((id) => id !== key);
  await writeStore(store);
}
