import "server-only";

import { paymentConfig } from "@/config/payment";

/** États PrestaShop considérés comme « payé » dans le back-office. */
export function getPrestaShopPaidStateIds(): string[] {
  const fromEnv = process.env.PRESTASHOP_PAID_STATE_IDS?.trim();
  if (fromEnv) {
    return fromEnv
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }
  return [String(paymentConfig.paidStateId), "11"];
}

export function isPrestaShopPaidState(
  state: string | number | null | undefined,
): boolean {
  if (state === null || state === undefined || state === "") return false;
  return getPrestaShopPaidStateIds().includes(String(state));
}
