import { publicConfig } from "@/config";

/** Format a price using the configured locale & currency. */
export function formatPrice(
  amount: number | null | undefined,
  currency: string = publicConfig.currency,
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return "—";
  }
  try {
    return new Intl.NumberFormat(publicConfig.locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Format an ISO date string into a readable localized date. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(publicConfig.locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Compute a discount percentage from a price/compare pair. */
export function discountPercent(
  price: number,
  compareAt: number | null,
): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
