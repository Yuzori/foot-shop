import "server-only";

import { runNotifyJob } from "@/lib/run-notify-job";
import { readSnapshot, writeSnapshot } from "@/lib/notify-state";

const THROTTLE_MS = 3 * 60 * 1000;

/**
 * Vérifie le catalogue et envoie les emails nouveautés / stock si besoin.
 * Appelé en arrière-plan depuis /api/products (max 1× / 3 min).
 */
export async function maybeRunCatalogNotifications(): Promise<void> {
  const snapshot = await readSnapshot();
  const last = snapshot.lastEmailRunAt
    ? Date.parse(snapshot.lastEmailRunAt)
    : 0;
  if (last && Date.now() - last < THROTTLE_MS) return;

  await runNotifyJob();

  const next = await readSnapshot();
  await writeSnapshot({
    ...next,
    lastEmailRunAt: new Date().toISOString(),
  });
}
