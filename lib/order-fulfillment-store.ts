import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), ".data", "fulfilled-orders.json");
const LOCK_FILE = path.join(process.cwd(), ".data", "fulfillment-claim.lock");

interface FulfillmentStore {
  orderIds: string[];
}

async function readStore(): Promise<FulfillmentStore> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const data = JSON.parse(raw) as FulfillmentStore;
    return { orderIds: Array.isArray(data.orderIds) ? data.orderIds : [] };
  } catch {
    return { orderIds: [] };
  }
}

export async function hasOrderBeenFulfilled(orderId: string): Promise<boolean> {
  const key = orderId.trim();
  if (!key) return false;
  const store = await readStore();
  return store.orderIds.includes(key);
}

/**
 * Réserve l'envoi des e-mails pour une commande (anti-doublon webhook + confirm).
 * Retourne false si la commande a déjà été traitée.
 */
export async function claimOrderFulfillment(orderId: string): Promise<boolean> {
  const key = orderId.trim();
  if (!key) return false;

  await fs.mkdir(path.dirname(FILE), { recursive: true });

  try {
    const handle = await fs.open(LOCK_FILE, "wx");
    await handle.close();
  } catch {
    return false;
  }

  try {
    const store = await readStore();
    if (store.orderIds.includes(key)) return false;
    store.orderIds.push(key);
    await fs.writeFile(FILE, JSON.stringify(store, null, 2), "utf8");
    return true;
  } finally {
    await fs.unlink(LOCK_FILE).catch(() => {});
  }
}

/** @deprecated Utiliser claimOrderFulfillment. */
export async function markOrderFulfilled(orderId: string): Promise<void> {
  const key = orderId.trim();
  if (!key) return;
  const store = await readStore();
  if (store.orderIds.includes(key)) return;
  store.orderIds.push(key);
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(store, null, 2), "utf8");
}
