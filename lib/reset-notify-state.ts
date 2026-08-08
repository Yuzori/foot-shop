import "server-only";

import { readSnapshot, writeSnapshot } from "@/lib/notify-state";
import { prestashop } from "@/services/prestashop";

/** Vide la file popup et marque tout le catalogue comme déjà notifié. */
export async function resetNotifyPopups(): Promise<{
  clearedQueue: number;
  notifiedTotal: number;
}> {
  const snapshot = await readSnapshot();
  const clearedQueue = snapshot.popupQueue?.length ?? 0;

  let allIds: string[] = [];
  if (prestashop.isConfigured) {
    const result = await prestashop.getProducts({ limit: 500, page: 1 });
    allIds = result.items.map((product) => product.id);
  }

  const notifiedProductIds = [
    ...new Set([...(snapshot.notifiedProductIds ?? []), ...allIds]),
  ];

  await writeSnapshot({
    ...snapshot,
    popupQueue: [],
    notifiedProductIds,
  });

  return {
    clearedQueue,
    notifiedTotal: notifiedProductIds.length,
  };
}
