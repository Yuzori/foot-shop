import { shopConfig } from "@/config/shop";
import type { StripeOrderLine } from "@/lib/stripe-admin-types";
import { normalizeProductNameForMatch } from "@/lib/parse-flocage-note";
import type { CreateOrderLine } from "@/services/prestashop";

export function parseFlocageLabel(label: string): { name: string; number: string } {
  const trimmed = label.trim();
  if (!trimmed) return { name: "", number: "" };

  const match = trimmed.match(/^(.+?)\s+(\d+)$/);
  if (match?.[1] && match[2]) {
    return { name: match[1].trim(), number: match[2].trim() };
  }

  return { name: trimmed, number: "" };
}

function findStripeLineForArchiveLine(
  line: CreateOrderLine,
  stripeLines: StripeOrderLine[],
): StripeOrderLine | undefined {
  const norm = normalizeProductNameForMatch(line.name ?? "");
  if (!norm) return undefined;

  return stripeLines.find((stripeLine) => {
    const stripeNorm = normalizeProductNameForMatch(stripeLine.name);
    return (
      stripeNorm === norm ||
      stripeNorm.includes(norm) ||
      norm.includes(stripeNorm)
    );
  });
}

/** Complète le flocage depuis les métadonnées Stripe (source de vérité au checkout). */
export function enrichOrderLinesFromStripeMeta(
  lines: CreateOrderLine[],
  stripeLines: StripeOrderLine[],
  flocageUnit: number = shopConfig.flocagePrice,
): CreateOrderLine[] {
  if (!stripeLines.length) return lines;

  return lines.map((line) => {
    if (line.flocage?.name?.trim() || line.flocage?.text?.trim()) {
      return line;
    }

    const stripeLine = findStripeLineForArchiveLine(line, stripeLines);
    const flocageLabel = stripeLine?.flocage?.trim();
    if (!flocageLabel) return line;

    const { name, number } = parseFlocageLabel(flocageLabel);
    if (!name) return line;

    return {
      ...line,
      flocage: {
        name,
        number,
        text: flocageLabel,
        price: flocageUnit,
      },
    };
  });
}
