/** PrestaShop category IDs may arrive as numbers from JSON / drafts. */
export function normalizeCategoryId(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  return "";
}
