import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), ".data", "fulfilled-orders.json");
const LOCK_FILE = path.join(process.cwd(), ".data", "fulfillment-claim.lock");

const MAX_LOCK_ATTEMPTS = 12;
const LOCK_WAIT_MS = 80;

interface FulfillmentStore {
  orderIds: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function writeStore(store: FulfillmentStore): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function hasOrderBeenFulfilled(orderId: string): Promise<boolean> {
  const key = orderId.trim();
  if (!key) return false;
  const store = await readStore();
  return store.orderIds.includes(key);
}

/**
 * Réserve le traitement d'une commande payée (anti-doublon webhook + confirm).
 * Retourne false si la commande a déjà été traitée.
 */
export async function claimOrderFulfillment(orderId: string): Promise<boolean> {
  const key = orderId.trim();
  if (!key) return false;

  await fs.mkdir(path.dirname(FILE), { recursive: true });

  for (let attempt = 0; attempt < MAX_LOCK_ATTEMPTS; attempt++) {
    const store = await readStore();
    if (store.orderIds.includes(key)) return false;

    try {
      const handle = await fs.open(LOCK_FILE, "wx");
      await handle.close();
      try {
        const fresh = await readStore();
        if (fresh.orderIds.includes(key)) return false;
        fresh.orderIds.push(key);
        await writeStore(fresh);
        return true;
      } finally {
        await fs.unlink(LOCK_FILE).catch(() => {});
      }
    } catch {
      await sleep(LOCK_WAIT_MS * (attempt + 1));
    }
  }

  const finalStore = await readStore();
  if (finalStore.orderIds.includes(key)) return false;

  console.error("[fulfillment] claim lock timeout — tentative sans verrou", key);
  finalStore.orderIds.push(key);
  await writeStore(finalStore);
  return true;
}

/** @deprecated Utiliser claimOrderFulfillment. */
export async function markOrderFulfilled(orderId: string): Promise<void> {
  const key = orderId.trim();
  if (!key) return;
  const store = await readStore();
  if (store.orderIds.includes(key)) return;
  store.orderIds.push(key);
  await writeStore(store);
}
