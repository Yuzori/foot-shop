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

function flocagePriceFromLine(line: CreateOrderLine, parsed?: ParsedFlocageNote): number {
  const fromLine = line.flocage?.price ?? 0;
  if (fromLine > 0) return fromLine;
  if (parsed?.price && parsed.price > 0) return parsed.price;
  return shopConfig.flocagePrice;
}

/** Complète les lignes archive : flocage + prix total (maillot + flocage). */
export function enrichOrderLinesWithFlocage(
  lines: CreateOrderLine[],
  note?: string | null,
): CreateOrderLine[] {
  const entries = parseFlocageEntriesFromNote(note);

  return lines.map((line) => {
    const parsed = findFlocageForLine(line, entries);
    const hadFlocageOnLine = Boolean(
      line.flocage?.name?.trim() || line.flocage?.text?.trim(),
    );
    const hasFlocageData = hadFlocageOnLine || Boolean(parsed);

    if (!hasFlocageData) return line;

    const flocageUnit = flocagePriceFromLine(line, parsed);
    const name = line.flocage?.name?.trim() || parsed?.name || "";
    const number = line.flocage?.number?.trim() || parsed?.number || "";
    const text =
      line.flocage?.text?.trim() ||
      [name, number].filter(Boolean).join(" ") ||
      undefined;

    // Prix PrestaShop = maillot seul ; pending checkout = maillot + flocage déjà inclus.
    const unitPrice =
      !hadFlocageOnLine && parsed
        ? Math.round((line.unitPrice + flocageUnit) * 100) / 100
        : line.unitPrice;

    return {
      ...line,
      unitPrice,
      flocage: {
        name,
        number,
        text,
        price: flocageUnit,
      },
    };
  });
}
