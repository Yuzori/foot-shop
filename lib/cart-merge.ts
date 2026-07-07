import type { CartLine } from "@/types/domain";

function cartLineKey(line: CartLine): string {
  return `${line.productId}:${line.variantId ?? ""}`;
}

/** Fusionne panier local et panier serveur (quantité max par ligne). */
export function mergeCartLines(
  local: CartLine[],
  server: CartLine[],
): CartLine[] {
  const map = new Map<string, CartLine>();

  for (const line of server) {
    map.set(cartLineKey(line), { ...line });
  }

  for (const line of local) {
    const key = cartLineKey(line);
    const existing = map.get(key);
    if (existing) {
      map.set(key, {
        ...existing,
        quantity: Math.max(existing.quantity, line.quantity),
        flocage: line.flocage ?? existing.flocage,
      });
    } else {
      map.set(key, { ...line });
    }
  }

  return Array.from(map.values());
}
