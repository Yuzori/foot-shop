import { formatFlocageLabel } from "@/config/shop";
import { enrichOrderLinesWithFlocage } from "@/lib/parse-flocage-note";
import type { OrderArchiveRecord } from "@/lib/order-archive-store";
import type { CreateOrderLine } from "@/services/prestashop";
import type { Order } from "@/types/domain";

export type OrderEmailLine = {
  label: string;
  detail?: string;
  amount: number;
};

export function formatShippingAddressHtml(archive: OrderArchiveRecord): string {
  const { contact, address } = archive;
  const lines = [
    `${contact.firstName} ${contact.lastName}`.trim(),
    address.address1,
    address.address2,
    `${address.postcode} ${address.city}`,
    address.country,
  ].filter((line): line is string => Boolean(line));

  return lines.map((line) => line.replace(/</g, "")).join("<br/>");
}

export function formatShippingAddressText(archive: OrderArchiveRecord): string {
  const { contact, address } = archive;
  return [
    `${contact.firstName} ${contact.lastName}`.trim(),
    address.address1,
    address.address2,
    `${address.postcode} ${address.city}`,
    address.country,
  ]
    .filter(Boolean)
    .join("\n");
}

function flocageLabel(line: CreateOrderLine): string {
  if (!line.flocage) return "";
  if (line.flocage.name?.trim()) {
    return formatFlocageLabel({
      name: line.flocage.name,
      number: line.flocage.number ?? "",
    });
  }
  return line.flocage.text?.trim() ?? "Flocage";
}

/** Lignes email avec flocage séparé du prix produit (depuis l'archive si dispo). */
export function buildOrderEmailLines(input: {
  archive?: OrderArchiveRecord | null;
  order?: Order;
}): OrderEmailLine[] {
  if (input.archive?.lines.length) {
    const archiveLines = enrichOrderLinesWithFlocage(
      input.archive.lines,
      input.archive.note,
    );
    const rows: OrderEmailLine[] = [];
    for (const line of archiveLines) {
      const flocageUnit = line.flocage?.price ?? 0;
      const productUnit = Math.max(0, line.unitPrice - flocageUnit);
      const size = line.optionsLabel?.trim();

      rows.push({
        label: line.name ?? "Article",
        detail: size || undefined,
        amount: productUnit * line.quantity,
      });

      if (line.flocage) {
        const label = flocageLabel(line);
        rows.push({
          label: label ? `Flocage : ${label}` : "Flocage personnalisé",
          amount: flocageUnit * line.quantity,
        });
      }
    }
    return rows;
  }

  return (input.order?.lines ?? []).map((line) => ({
    label: line.name,
    amount: line.unitPrice * line.quantity,
  }));
}
