import { firstOrderThankYouPromo } from "@/config/promotions";

export interface PromoCodeResult {
  valid: boolean;
  code: string;
  percent: number;
  label: string;
}

export function resolvePromoCode(raw: string | undefined | null): PromoCodeResult | null {
  const code = raw?.trim().toUpperCase() ?? "";
  if (!code) return null;

  if (code === firstOrderThankYouPromo.code) {
    return {
      valid: true,
      code: firstOrderThankYouPromo.code,
      percent: firstOrderThankYouPromo.percent,
      label: firstOrderThankYouPromo.label,
    };
  }

  return { valid: false, code, percent: 0, label: "" };
}

export function applyPercentDiscount(subtotal: number, percent: number): number {
  if (percent <= 0 || subtotal <= 0) return 0;
  return Math.round(subtotal * (percent / 100) * 100) / 100;
}
