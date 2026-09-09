/**
 * Vérifie que l'email récap affiche bien le flocage (ligne séparée + prix total).
 *
 * Usage : npx tsx scripts/test-order-email-flocage.ts
 */
import Module from "node:module";

const moduleLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {};
  return moduleLoad.apply(this, [request, parent, isMain]);
};

import { shopConfig } from "../config/shop";
import { buildOrderEmailLines } from "../lib/order-email-lines";
import {
  enrichOrderLinesWithFlocage,
  parseFlocageEntriesFromNote,
} from "../lib/parse-flocage-note";
import type { OrderArchiveRecord } from "../lib/order-archive-store";
import type { CreateOrderLine } from "../services/prestashop";
import { formatPrice } from "../lib/format";

type CaseResult = { name: string; ok: boolean; details: string[] };

function assert(name: string, condition: boolean, msg: string): CaseResult {
  return {
    name,
    ok: condition,
    details: condition ? [`✓ ${msg}`] : [`✗ ${msg}`],
  };
}

function runCase(
  title: string,
  archive: OrderArchiveRecord,
  expectations: {
    lineCount: number;
    hasFlocageLine: boolean;
    productAmount: number;
    flocageAmount?: number;
    flocageLabelContains?: string;
  },
): CaseResult {
  const details: string[] = [];
  const lines = buildOrderEmailLines({ archive });
  const productLine = lines[0];
  const flocageLine = lines.find((l) => l.label.toLowerCase().includes("flocage"));

  details.push(`Lignes email : ${lines.map((l) => `${l.label} = ${formatPrice(l.amount)}`).join(" | ")}`);

  let ok = true;
  if (lines.length !== expectations.lineCount) {
    ok = false;
    details.push(`✗ Attendu ${expectations.lineCount} lignes, reçu ${lines.length}`);
  } else {
    details.push(`✓ ${expectations.lineCount} ligne(s)`);
  }

  if (expectations.hasFlocageLine) {
    if (!flocageLine) {
      ok = false;
      details.push("✗ Ligne flocage absente");
    } else {
      details.push(`✓ Ligne flocage : ${flocageLine.label} = ${formatPrice(flocageLine.amount)}`);
      if (expectations.flocageAmount !== undefined && flocageLine.amount !== expectations.flocageAmount) {
        ok = false;
        details.push(
          `✗ Montant flocage attendu ${formatPrice(expectations.flocageAmount)}, reçu ${formatPrice(flocageLine.amount)}`,
        );
      }
      if (expectations.flocageLabelContains && !flocageLine.label.includes(expectations.flocageLabelContains)) {
        ok = false;
        details.push(`✗ Label flocage ne contient pas « ${expectations.flocageLabelContains} »`);
      }
    }
  } else if (flocageLine) {
    ok = false;
    details.push("✗ Ligne flocage présente alors qu'aucun flocage attendu");
  } else {
    details.push("✓ Pas de ligne flocage");
  }

  if (productLine.amount !== expectations.productAmount) {
    ok = false;
    details.push(
      `✗ Prix maillot attendu ${formatPrice(expectations.productAmount)}, reçu ${formatPrice(productLine.amount)}`,
    );
  } else {
    details.push(`✓ Prix maillot ${formatPrice(productLine.amount)}`);
  }

  return { name: title, ok, details };
}

function baseArchive(overrides: Partial<OrderArchiveRecord>): OrderArchiveRecord {
  return {
    id: "test",
    reference: "TESTFLOC",
    orderId: "99",
    customerId: null,
    createdAt: new Date().toISOString(),
    paidAt: new Date().toISOString(),
    status: "paid",
    contact: {
      firstName: "Jean",
      lastName: "Test",
      email: "test@example.com",
      phone: "0600000000",
    },
    address: {
      address1: "1 rue Test",
      postcode: "75001",
      city: "Paris",
      country: "France",
    },
    lines: [],
    subtotal: 29.98,
    shippingFee: 0,
    promoCode: null,
    promoDiscount: 0,
    total: 29.98,
    currency: "EUR",
    note: null,
    stripeSessionId: null,
    source: "stripe",
    stockReserved: false,
    ...overrides,
  };
}

function main(): void {
  const productName = "Maillot Espagne Domicile 2026";
  const jerseyOnly = 25.99;
  const flocagePrice = shopConfig.flocagePrice;

  const flocageLine: CreateOrderLine = {
    productId: "462",
    variantId: "1613",
    quantity: 1,
    unitPrice: jerseyOnly + flocagePrice,
    name: productName,
    optionsLabel: "M",
    flocage: {
      name: "MESSI",
      number: "7",
      text: "MESSI 7",
      price: flocagePrice,
    },
  };

  const note = `${productName} (x1) - FLOCAGE NOM="MESSI" NUM="7" (+${flocagePrice.toFixed(2)} EUR/maillot)`;
  const parsed = parseFlocageEntriesFromNote(note);

  const results: CaseResult[] = [];

  results.push(
    assert(
      "parse note fournisseur",
      parsed.length === 1 && parsed[0].number === "7" && parsed[0].price === flocagePrice,
      `note parsée : nom=${parsed[0]?.name}, num=${parsed[0]?.number}, prix=${parsed[0]?.price}`,
    ),
  );

  const enrichedFromPs = enrichOrderLinesWithFlocage(
    [
      {
        productId: "462",
        variantId: "1613",
        quantity: 1,
        unitPrice: jerseyOnly,
        name: productName,
        optionsLabel: "M",
      },
    ],
    note,
  );

  const enrichedTotal = Math.round(enrichedFromPs[0].unitPrice * 100) / 100;
  results.push(
    assert(
      "enrichissement PrestaShop (prix maillot seul)",
      enrichedTotal === Math.round((jerseyOnly + flocagePrice) * 100) / 100 &&
        enrichedFromPs[0].flocage?.number === "7",
      `unitPrice=${enrichedTotal}, flocage num=${enrichedFromPs[0].flocage?.number}`,
    ),
  );

  results.push(
    runCase("Archive pending (flocage complet)", baseArchive({ lines: [flocageLine], note }), {
      lineCount: 2,
      hasFlocageLine: true,
      productAmount: jerseyOnly,
      flocageAmount: flocagePrice,
      flocageLabelContains: "MESSI",
    }),
  );

  results.push(
    runCase(
      "Archive PrestaShop sans objet flocage (note fournisseur)",
      baseArchive({
        lines: [
          {
            productId: "462",
            variantId: "1613",
            quantity: 1,
            unitPrice: jerseyOnly,
            name: productName,
            optionsLabel: "M",
          },
        ],
        note,
      }),
      {
        lineCount: 2,
        hasFlocageLine: true,
        productAmount: jerseyOnly,
        flocageAmount: flocagePrice,
        flocageLabelContains: "7",
      },
    ),
  );

  results.push(
    runCase(
      "Commande sans flocage",
      baseArchive({
        lines: [
          {
            productId: "462",
            variantId: "1613",
            quantity: 1,
            unitPrice: jerseyOnly,
            name: productName,
            optionsLabel: "M",
          },
        ],
        note: "",
        subtotal: jerseyOnly,
        total: jerseyOnly,
      }),
      {
        lineCount: 1,
        hasFlocageLine: false,
        productAmount: jerseyOnly,
      },
    ),
  );

  console.log("=== Test email récap flocage ===\n");
  let failed = 0;
  for (const result of results) {
    console.log(result.ok ? "PASS" : "FAIL", "-", result.name);
    for (const line of result.details) console.log("  ", line);
    console.log();
    if (!result.ok) failed++;
  }

  if (failed > 0) {
    console.error(`Échec : ${failed}/${results.length} scénario(s).`);
    process.exit(1);
  }

  console.log(`OK : ${results.length}/${results.length} scénario(s) validés.`);
}

main();
