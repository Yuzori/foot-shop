import "server-only";

import { formatFlocageLabel } from "@/config/shop";
import type { StripeOrderLine } from "@/lib/stripe-admin-types";
import type { CreateOrderLine } from "@/services/prestashop";

export type OrderLineForMetadata = CreateOrderLine & {
  optionsLabel?: string;
};

export type StripeOrderMetadataInput = {
  reference: string;
  orderId: string;
  customerId: string;
  contact: { firstName: string; lastName: string; email: string; phone?: string };
  address: {
    address1: string;
    address2?: string;
    postcode: string;
    city: string;
    country: string;
  };
  lines: OrderLineForMetadata[];
  welcomePromo?: boolean;
  expectedTotalCents?: number;
  bogoFreeUnits?: number;
  promoCode?: string | null;
  promoDiscountCents?: number;
  shippingCents?: number;
};

const META_VALUE_MAX = 500;
const META_CHUNK_SIZE = 450;
const META_MAX_KEYS = 50;

function formatFlocageForMeta(
  flocage: NonNullable<CreateOrderLine["flocage"]>,
): string {
  if (flocage.name) {
    return formatFlocageLabel({
      name: flocage.name,
      number: flocage.number ?? "",
    });
  }
  return flocage.text?.trim() || "";
}

function extractSize(optionsLabel?: string): string {
  if (!optionsLabel?.trim()) return "";
  return optionsLabel.replace(/^taille:\s*/i, "").trim();
}

export function orderLinesToStripeMeta(lines: OrderLineForMetadata[]): StripeOrderLine[] {
  return lines.map((line) => ({
    name: line.name?.trim() || `Produit #${line.productId}`,
    quantity: line.quantity,
    size: extractSize(line.optionsLabel),
    flocage: line.flocage ? formatFlocageForMeta(line.flocage) : "",
  }));
}

export function buildStripeLineItemDescription(line: OrderLineForMetadata): string | undefined {
  const parts: string[] = [];
  const size = extractSize(line.optionsLabel);
  if (size) parts.push(`Taille: ${size}`);
  if (line.flocage) {
    const flocage = formatFlocageForMeta(line.flocage);
    if (flocage) parts.push(`Flocage: ${flocage}`);
  }
  const text = parts.join(" · ").trim();
  return text ? text.slice(0, META_VALUE_MAX) : undefined;
}

function chunkJsonMetadata(prefix: string, data: unknown): Record<string, string> {
  const json = JSON.stringify(data);
  if (json.length <= META_VALUE_MAX) {
    return { [prefix]: json };
  }

  const chunks: Record<string, string> = {
    [`${prefix}Count`]: String(Math.ceil(json.length / META_CHUNK_SIZE)),
  };
  for (let i = 0; i < json.length; i += META_CHUNK_SIZE) {
    chunks[`${prefix}${Math.floor(i / META_CHUNK_SIZE)}`] = json.slice(
      i,
      i + META_CHUNK_SIZE,
    );
  }
  return chunks;
}

/** Métadonnées Stripe Checkout — source de vérité admin commandes. */
export function buildStripeOrderMetadata(input: StripeOrderMetadataInput): Record<string, string> {
  const shippingName = `${input.contact.firstName} ${input.contact.lastName}`.trim();
  const shippingAddress = [
    input.address.address1,
    input.address.address2,
    `${input.address.postcode} ${input.address.city}`,
    input.address.country,
  ]
    .filter(Boolean)
    .join(", ");

  const lineMeta = orderLinesToStripeMeta(input.lines);

  const meta: Record<string, string> = {
    orderId: input.orderId,
    reference: input.reference,
    customerId: input.customerId,
    customerEmail: input.contact.email.trim(),
    customerPhone: input.contact.phone?.trim() || "",
    shippingName,
    shippingAddress: shippingAddress.slice(0, META_VALUE_MAX),
    lineCount: String(lineMeta.length),
    welcomePromo: input.welcomePromo ? "1" : "",
    expectedTotalCents: String(input.expectedTotalCents ?? ""),
    bogoFreeUnits: input.bogoFreeUnits ? String(input.bogoFreeUnits) : "",
    promoCode: input.promoCode ?? "",
    promoDiscountCents: input.promoDiscountCents ? String(input.promoDiscountCents) : "",
    shippingCents: String(input.shippingCents ?? ""),
    ...chunkJsonMetadata("lines", lineMeta),
  };

  const keys = Object.keys(meta);
  if (keys.length > META_MAX_KEYS) {
    delete meta.lines;
    delete meta.linesCount;
    for (const key of keys) {
      if (key.startsWith("lines")) delete meta[key];
    }
    meta.linesSummary = lineMeta
      .map((line) => `${line.quantity}x ${line.name}`)
      .join("; ")
      .slice(0, META_VALUE_MAX);
  }

  return meta;
}

export function parseStripeOrderLinesFromMetadata(
  metadata: Record<string, string> | null | undefined,
): StripeOrderLine[] {
  if (!metadata) return [];

  if (metadata.lines) {
    try {
      const parsed = JSON.parse(metadata.lines) as StripeOrderLine[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  const count = Number.parseInt(metadata.linesCount ?? "0", 10);
  if (!count) return [];

  let json = "";
  for (let i = 0; i < count; i++) {
    json += metadata[`lines${i}`] ?? "";
  }
  try {
    const parsed = JSON.parse(json) as StripeOrderLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function inferAbandonCauseFromStripeSession(input: {
  status: string | null;
  paymentStatus: string | null;
}): string {
  if (input.paymentStatus === "unpaid" && input.status === "expired") {
    return "Session expirée — le client a quitté le paiement sans finaliser";
  }
  if (input.paymentStatus === "unpaid" && input.status === "open") {
    return "Paiement non finalisé — abandon en cours de checkout";
  }
  return "Paiement non reçu";
}
