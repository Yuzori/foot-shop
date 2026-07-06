import type { CartLine } from "@/types/domain";

const KEY = "maillot-checkout-cart";

/** Snapshot figé au début du checkout — survit aux vidages intempestifs du store. */
export function saveCheckoutCartSnapshot(lines: CartLine[]): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* quota / navigation privée */
  }
}

export function loadCheckoutCartSnapshot(): CartLine[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearCheckoutCartSnapshot(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
