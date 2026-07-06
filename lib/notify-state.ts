import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Tiny JSON snapshot of product availability, used to detect what's NEW or
 * BACK IN STOCK between two runs of the notifier. Stored at the project root.
 */
export interface ProductSnapshot {
  /** Map productId -> last known inStock state. */
  items: Record<string, { inStock: boolean }>;
  updatedAt: string | null;
  /** Dernière exécution de l'envoi d'emails catalogue (throttle). */
  lastEmailRunAt: string | null;
  /** Dernière vérification des alertes stock (cloche). */
  lastStockCheckAt: string | null;
}

const FILE = path.join(process.cwd(), ".notify-state.json");

export async function readSnapshot(): Promise<ProductSnapshot> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as ProductSnapshot;
  } catch {
    return { items: {}, updatedAt: null, lastEmailRunAt: null, lastStockCheckAt: null };
  }
}

export async function writeSnapshot(snapshot: ProductSnapshot): Promise<void> {
  await fs.writeFile(FILE, JSON.stringify(snapshot, null, 2), "utf8");
}
