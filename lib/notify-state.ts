import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Snapshot catalogue pour détecter les nouveautés / retours stock.
 * Persisté dans `.data/` pour survivre aux redéploiements.
 */
export interface ProductSnapshot {
  /** Map productId -> dernier état stock connu. */
  items: Record<string, { inStock: boolean }>;
  updatedAt: string | null;
  /** Dernière exécution de l'envoi d'emails catalogue (throttle). */
  lastEmailRunAt: string | null;
  /** Dernière vérification des alertes stock (cloche). */
  lastStockCheckAt: string | null;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "notify-state.json");
const LEGACY_FILE = path.join(process.cwd(), ".notify-state.json");
const LOCK_FILE = path.join(DATA_DIR, "notify-job.lock");

const EMPTY_SNAPSHOT: ProductSnapshot = {
  items: {},
  updatedAt: null,
  lastEmailRunAt: null,
  lastStockCheckAt: null,
};

export function isSnapshotBootstrapped(snapshot: ProductSnapshot): boolean {
  return Object.keys(snapshot.items).length > 0;
}

async function migrateLegacySnapshot(): Promise<void> {
  try {
    const raw = await fs.readFile(LEGACY_FILE, "utf8");
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, raw, "utf8");
    await fs.unlink(LEGACY_FILE);
  } catch {
    /* pas de fichier legacy */
  }
}

export async function readSnapshot(): Promise<ProductSnapshot> {
  await migrateLegacySnapshot();
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const data = JSON.parse(raw) as ProductSnapshot;
    return {
      items: data.items ?? {},
      updatedAt: data.updatedAt ?? null,
      lastEmailRunAt: data.lastEmailRunAt ?? null,
      lastStockCheckAt: data.lastStockCheckAt ?? null,
    };
  } catch {
    return { ...EMPTY_SNAPSHOT };
  }
}

export async function writeSnapshot(snapshot: ProductSnapshot): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(snapshot, null, 2), "utf8");
}

/** Verrou simple anti double exécution (PM2 cluster / requêtes parallèles). */
export async function withNotifyJobLock<T>(
  fn: () => Promise<T>,
): Promise<T | null> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    const handle = await fs.open(LOCK_FILE, "wx");
    await handle.writeFile(
      JSON.stringify({ pid: process.pid, at: new Date().toISOString() }),
      "utf8",
    );
    await handle.close();
  } catch {
    return null;
  }

  try {
    return await fn();
  } finally {
    await fs.unlink(LOCK_FILE).catch(() => {});
  }
}
