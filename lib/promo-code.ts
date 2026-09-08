import { apologyPromo, firstOrderThankYouPromo, flocageTestPromo } from "@/config/promotions";

export type PromoCodeKind = "percent" | "flocage_price";

export interface PromoCodeResult {
  valid: boolean;
  code: string;
  kind: PromoCodeKind;
  percent: number;
  label: string;
  flocagePrice?: number;
}

export function resolvePromoCode(raw: string | undefined | null): PromoCodeResult | null {
  const code = raw?.trim().toUpperCase() ?? "";
  if (!code) return null;

  if (code === firstOrderThankYouPromo.code) {
    return {
      valid: true,
      code: firstOrderThankYouPromo.code,
      kind: "percent",
      percent: firstOrderThankYouPromo.percent,
      label: firstOrderThankYouPromo.label,
    };
  }

  if (code === apologyPromo.code) {
    return {
      valid: true,
      code: apologyPromo.code,
      kind: "percent",
      percent: apologyPromo.percent,
      label: apologyPromo.label,
    };
  }

  if (code === flocageTestPromo.code) {
    return {
      valid: true,
      code: flocageTestPromo.code,
      kind: "flocage_price",
      percent: 0,
      label: flocageTestPromo.label,
      flocagePrice: flocageTestPromo.flocagePrice,
    };
  }

  return { valid: false, code, kind: "percent", percent: 0, label: "" };
}

export function applyPercentDiscount(subtotal: number, percent: number): number {
  if (percent <= 0 || subtotal <= 0) return 0;
  return Math.round(subtotal * (percent / 100) * 100) / 100;
}
