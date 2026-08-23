import type { CartLine } from "@/types/domain";

/** Fusionne les favoris locaux et serveur (ordre local d'abord, sans doublons). */
export function mergeFavoriteIds(local: string[], server: string[]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const id of [...local, ...server]) {
    const trimmed = id?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    merged.push(trimmed);
  }

  return merged;
}

/** Panier actif : le local s'il n'est pas vide, sinon le serveur. */
export function resolveCartLines(
  local: CartLine[],
  server: CartLine[],
): CartLine[] {
  return local.length > 0 ? local : server;
}

export function preferencesSignature(
  cart: CartLine[],
  favorites: string[],
): string {
  return JSON.stringify({ cart, favorites });
}
