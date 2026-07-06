import type { CartLine } from "@/types/domain";

const KEY = "maillot-checkout-session";

export interface StoredCheckoutSession {
  step: "payment";
  clientSecret: string;
  publishableKey: string;
  orderReference: string | null;
  lines: CartLine[];
  stripeBogoDiscount: number;
  stripeFreeUnits: number;
}

export function saveCheckoutSession(data: StoredCheckoutSession): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

export function loadCheckoutSession(): StoredCheckoutSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredCheckoutSession;
    if (data.step !== "payment" || !data.clientSecret || !data.publishableKey) {
      return null;
    }
    if (!Array.isArray(data.lines) || data.lines.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearCheckoutSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
