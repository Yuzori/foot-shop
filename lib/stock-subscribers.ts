import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

export interface StockSubscription {
  email: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantLabel: string | null;
  imageUrl: string | null;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "stock-subscribers.json");
const LEGACY_FILE = path.join(process.cwd(), ".stock-subscribers.json");

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readStockSubscribers(): Promise<StockSubscription[]> {
  for (const filePath of [FILE, LEGACY_FILE]) {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      return JSON.parse(raw) as StockSubscription[];
    } catch {
      /* try next */
    }
  }
  return [];
}

export async function writeStockSubscribers(
  subs: StockSubscription[],
): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(FILE, JSON.stringify(subs, null, 2), "utf8");
}

export async function addStockSubscriber(
  sub: Omit<StockSubscription, "createdAt">,
): Promise<{ added: boolean }> {
  const all = await readStockSubscribers();
  const exists = all.some(
    (s) =>
      s.email === sub.email &&
      s.productId === sub.productId &&
      s.variantId === sub.variantId,
  );
  if (exists) return { added: false };
  all.push({ ...sub, createdAt: new Date().toISOString() });
  await writeStockSubscribers(all);
  return { added: true };
}

export async function removeStockSubscribers(
  keys: Array<{ email: string; productId: string; variantId: string | null }>,
): Promise<void> {
  const all = await readStockSubscribers();
  const filtered = all.filter(
    (s) =>
      !keys.some(
        (k) =>
          k.email === s.email &&
          k.productId === s.productId &&
          k.variantId === s.variantId,
      ),
  );
  await writeStockSubscribers(filtered);
}

export async function isStockSubscribed(
  email: string,
  productId: string,
  variantId: string | null,
): Promise<boolean> {
  const all = await readStockSubscribers();
  const normalized = email.trim().toLowerCase();
  return all.some(
    (s) =>
      s.email === normalized &&
      s.productId === productId &&
      s.variantId === variantId,
  );
}
