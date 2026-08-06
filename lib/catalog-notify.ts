import "server-only";

import { readSnapshot, writeSnapshot, isSnapshotBootstrapped } from "@/lib/notify-state";
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

  // Premier passage après déploiement : enregistrer l'état sans envoyer d'emails.
  if (!isSnapshotBootstrapped(snapshot)) {
    const { runNotifyJob } = await import("@/lib/run-notify-job");
    await runNotifyJob();
    return;
  }

  const { runNotifyJob } = await import("@/lib/run-notify-job");
  await runNotifyJob();

  const next = await readSnapshot();
  await writeSnapshot({
    ...next,
    lastEmailRunAt: new Date().toISOString(),
  });
}
