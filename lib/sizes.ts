import type { ProductOptionValue } from "@/types/domain";

import { shopConfig } from "@/config/shop";

const SIZE_GROUP_RE = /taille|size|pointure/i;

/** Détecte le groupe « Taille » (PrestaShop FR/EN). */
export function isSizeGroup(name: string): boolean {
  return SIZE_GROUP_RE.test(name);
}

/** Trie XS → XXL ; les tailles inconnues restent à la fin. */
export function sortSizeValues(values: ProductOptionValue[]): ProductOptionValue[] {
  const order = shopConfig.sizeOrder;
  const rank = (label: string) => {
    const n = label.trim().toUpperCase();
    const i = order.indexOf(n as typeof order[number]);
    return i === -1 ? 999 : i;
  };
  return [...values].sort((a, b) => rank(a.label) - rank(b.label));
}
