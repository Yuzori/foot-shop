import { shopConfig } from "@/config/shop";
import type { CreateOrderLine } from "@/services/prestashop";

export type ParsedFlocageNote = {
  productName: string;
  quantity: number;
  name: string;
  number: string;
  price: number;
};

/** Parse la note fournisseur (buildOrderNote) pour retrouver le flocage. */
export function parseFlocageEntriesFromNote(note: string | undefined | null): ParsedFlocageNote[] {
  if (!note?.trim()) return [];

  const entries: ParsedFlocageNote[] = [];
  const pattern =
    /^(.+?)\s*\(x(\d+)\)\s*-\s*FLOCAGE NOM="([^"]*)"\s*NUM="([^"]*)"\s*\(\+([\d.,]+)\s*EUR\/maillot\)/gim;

  for (const match of note.matchAll(pattern)) {
    entries.push({
      productName: match[1]?.trim() ?? "",
      quantity: Number.parseInt(match[2] ?? "1", 10) || 1,
      name: match[3]?.trim() ?? "",
      number: match[4]?.trim() ?? "",
      price: Number.parseFloat((match[5] ?? "0").replace(",", ".")) || shopConfig.flocagePrice,
    });
  }

  return entries;
}

function findFlocageForLine(
  line: CreateOrderLine,
  entries: ParsedFlocageNote[],
): ParsedFlocageNote | undefined {
  const name = line.name?.trim() ?? "";
  return entries.find((entry) => entry.productName === name);
}

/** Complète les lignes archive sans objet flocage (ex. rebuild PrestaShop). */
export function enrichOrderLinesWithFlocage(
  lines: CreateOrderLine[],
  note?: string | null,
): CreateOrderLine[] {
  const entries = parseFlocageEntriesFromNote(note);
  if (entries.length === 0) return lines;

  return lines.map((line) => {
    if (line.flocage?.name || line.flocage?.text) return line;

    const parsed = findFlocageForLine(line, entries);
    if (!parsed) return line;

    const flocageUnit = parsed.price;
    const productOnly =
      line.unitPrice > flocageUnit + 0.5
        ? line.unitPrice - flocageUnit
        : line.unitPrice;

    return {
      ...line,
      unitPrice: Math.round((productOnly + flocageUnit) * 100) / 100,
      flocage: {
        name: parsed.name,
        number: parsed.number,
        text: parsed.name && parsed.number ? `${parsed.name} ${parsed.number}` : parsed.name,
        price: flocageUnit,
      },
    };
  });
}
