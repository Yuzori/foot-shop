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
  /** Produits en attente d'affichage dans la modale site (survit au snapshot). */
  popupQueue?: string[];
  /** Produits déjà notifiés (popup + email). */
  notifiedProductIds?: string[];
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
  popupQueue: [],
  notifiedProductIds: [],
};

export function isSnapshotBootstrapped(snapshot: ProductSnapshot): boolean {
  return Object.keys(snapshot.items).length > 0;
}

/**
 * Après un déploiement si `notifiedProductIds` a été perdu alors que le
 * catalogue est déjà suivi : marquer tout comme notifié sans renvoyer d'alertes.
 */
export function repairNotifySnapshot(snapshot: ProductSnapshot): ProductSnapshot {
  const itemIds = Object.keys(snapshot.items);
  const notified = snapshot.notifiedProductIds ?? [];
  if (itemIds.length > 0 && notified.length === 0) {
    return { ...snapshot, notifiedProductIds: [...itemIds] };
  }
  return snapshot;
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
      popupQueue: Array.isArray(data.popupQueue) ? data.popupQueue : [],
      notifiedProductIds: Array.isArray(data.notifiedProductIds)
        ? data.notifiedProductIds
        : [],
    };
  } catch {
    return { ...EMPTY_SNAPSHOT };
  }
}

export async function writeSnapshot(snapshot: ProductSnapshot): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(snapshot, null, 2), "utf8");
}

export async function enqueuePopupProducts(productIds: string[]): Promise<void> {
  const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return;
  const snapshot = await readSnapshot();
  const queue = new Set([...(snapshot.popupQueue ?? []), ...ids]);
  await writeSnapshot({ ...snapshot, popupQueue: [...queue] });
}

export async function dequeuePopupProducts(productIds: string[]): Promise<void> {
  const remove = new Set(productIds.map((id) => id.trim()).filter(Boolean));
  if (remove.size === 0) return;
  const snapshot = await readSnapshot();
  const queue = (snapshot.popupQueue ?? []).filter((id) => !remove.has(id));
  await writeSnapshot({ ...snapshot, popupQueue: queue });
}

export async function markProductsNotified(productIds: string[]): Promise<void> {
  const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return;
  const snapshot = await readSnapshot();
  const notified = new Set([...(snapshot.notifiedProductIds ?? []), ...ids]);
  await writeSnapshot({
    ...snapshot,
    notifiedProductIds: [...notified],
  });
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
