import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), ".data", "welcome-promo.json");

interface WelcomePromoStore {
  eligible: string[];
  used: string[];
}

async function readStore(): Promise<WelcomePromoStore> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const data = JSON.parse(raw) as WelcomePromoStore;
    return {
      eligible: Array.isArray(data.eligible) ? data.eligible : [],
      used: Array.isArray(data.used) ? data.used : [],
    };
  } catch {
    return { eligible: [], used: [] };
  }
}

async function writeStore(store: WelcomePromoStore): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(store, null, 2), "utf8");
}

export type WelcomePromoStatus = "none" | "eligible" | "used";

export async function getWelcomePromoStatus(
  customerId: string,
): Promise<WelcomePromoStatus> {
  const key = customerId.trim();
  if (!key) return "none";
  const store = await readStore();
  if (store.used.includes(key)) return "used";
  if (store.eligible.includes(key)) return "eligible";
  return "none";
}

export async function grantWelcomePromo(customerId: string): Promise<void> {
  const key = customerId.trim();
  if (!key) return;
  const store = await readStore();
  if (store.used.includes(key) || store.eligible.includes(key)) return;
  store.eligible.push(key);
  await writeStore(store);
}

export async function isWelcomePromoEligible(customerId: string): Promise<boolean> {
  return (await getWelcomePromoStatus(customerId)) === "eligible";
}

export async function markWelcomePromoUsed(customerId: string): Promise<void> {
  const key = customerId.trim();
  if (!key) return;
  const store = await readStore();
  store.eligible = store.eligible.filter((id) => id !== key);
  if (!store.used.includes(key)) store.used.push(key);
  await writeStore(store);
}
