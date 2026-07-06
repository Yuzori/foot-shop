import "server-only";

import { readSnapshot, writeSnapshot } from "@/lib/notify-state";
import { processStockAlertEmails } from "@/lib/stock-alerts";

const STOCK_THROTTLE_MS = 60 * 1000;

/** Traite les alertes cloche — appelé à chaque visite produit / catalogue (max 1×/min). */
export async function maybeProcessStockAlerts(): Promise<number> {
  const snapshot = await readSnapshot();
  const last = snapshot.lastStockCheckAt
    ? Date.parse(snapshot.lastStockCheckAt)
    : 0;
  if (last && Date.now() - last < STOCK_THROTTLE_MS) return 0;

  const sent = await processStockAlertEmails();

  await writeSnapshot({
    ...(await readSnapshot()),
    lastStockCheckAt: new Date().toISOString(),
  });

  return sent;
}
