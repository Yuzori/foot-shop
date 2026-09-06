import "server-only";

import { prestashop } from "@/services/prestashop";
import type { Order } from "@/types/domain";

/** Référence PrestaShop ou numéro de commande (id) saisi par le client. */
export async function resolveOrderForTracking(
  input: string,
): Promise<Order | null> {
  const raw = input.trim();
  if (!raw) return null;

  const byReference = await prestashop.getOrderByReference(raw);
  if (byReference) return byReference;

  if (/^\d+$/.test(raw)) {
    const byId = await prestashop.getOrderById(raw);
    if (byId) return byId;
  }

  const normalized = raw.toUpperCase();
  if (normalized !== raw) {
    const byUpper = await prestashop.getOrderByReference(normalized);
    if (byUpper) return byUpper;
  }

  return null;
}
