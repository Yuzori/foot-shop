import type { FlocageOption } from "@/types/domain";

import { formatFlocageLabel } from "@/config/shop";

/** Libellé affiché pour un flocage (gère l'ancien format `text`). */
export function getFlocageDisplay(f?: FlocageOption): string {
  if (!f?.enabled) return "";
  if (f.name?.trim()) return formatFlocageLabel(f);
  return f.text?.trim() ?? "";
}
