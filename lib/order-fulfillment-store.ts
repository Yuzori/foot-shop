import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), ".data", "fulfilled-orders.json");

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

/** Marque une commande comme finalisée (emails envoyés). */
export async function markOrderFulfilled(orderId: string): Promise<void> {
  const key = orderId.trim();
  if (!key) return;

  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const store = await readStore();
  if (store.orderIds.includes(key)) return;

  store.orderIds.push(key);
  await fs.writeFile(FILE, JSON.stringify(store, null, 2), "utf8");
}
