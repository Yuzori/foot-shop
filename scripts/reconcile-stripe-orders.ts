/**
 * Compare les paiements Stripe réussis avec les commandes PrestaShop.
 *
 * Usage : npx tsx scripts/reconcile-stripe-orders.ts
 */
import Module from "node:module";
import fs from "node:fs";
import path from "node:path";

const moduleLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {};
  return moduleLoad.apply(this, [request, parent, isMain]);
};

function loadEnvFile(file: string): void {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

async function main(): Promise<void> {
  const { paymentConfig } = await import("../config/payment");
  const { isPrestaShopPaidState } = await import("../lib/prestashop-order-states");
  if (!paymentConfig.stripeEnabled) {
    console.error("STRIPE_SECRET_KEY manquant.");
    process.exit(2);
  }

  const { getStripe } = await import("../lib/stripe-server");
  const { isCheckoutSessionPaidOnStripe } = await import(
    "../lib/stripe-checkout-session-status"
  );
  const { prestashop } = await import("../services/prestashop");
  const { verifyPrestaShopOrderHasStripePayment } = await import(
    "../lib/stripe-order-reconcile"
  );

  const stripe = getStripe();
  const psOrders = await prestashop.listRecentOrders(50);

  const paidSessions: Array<{
    sessionId: string;
    amount: number;
    email: string | null;
    orderId: string | null;
    reference: string | null;
    created: string;
  }> = [];

  let startingAfter: string | undefined;
  for (let page = 0; page < 5; page++) {
    const batch = await stripe.checkout.sessions.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const session of batch.data) {
      if (!isCheckoutSessionPaidOnStripe(session)) continue;
      paidSessions.push({
        sessionId: session.id,
        amount: (session.amount_total ?? 0) / 100,
        email: session.customer_email ?? session.metadata?.customerEmail ?? null,
        orderId: session.metadata?.orderId ?? null,
        reference: session.metadata?.reference ?? null,
        created: new Date((session.created ?? 0) * 1000).toISOString(),
      });
    }
    if (!batch.has_more || batch.data.length === 0) break;
    startingAfter = batch.data[batch.data.length - 1]?.id;
  }

  paidSessions.sort((a, b) => b.created.localeCompare(a.created));

  console.log("=== PAIEMENTS STRIPE CONFIRMÉS (source de vérité) ===\n");
  for (const row of paidSessions) {
    console.log(
      `  ${row.created.slice(0, 10)} | ${row.amount.toFixed(2)} € | ${row.email ?? "?"} | ref ${row.reference ?? "?"} | PS#${row.orderId ?? "?"}`,
    );
  }
  console.log(`\nTotal : ${paidSessions.length} paiement(s) confirmé(s)\n`);

  console.log("=== COMMANDES PRESTASHOP RÉCENTES ===\n");
  const stateLabels: Record<string, string> = {
    "1": "En attente",
    "2": "Payée",
    "6": "Annulée",
    "8": "Erreur paiement",
  };

  const phantomPaid: string[] = [];
  const stripeMissingFulfillment: string[] = [];

  for (const ps of psOrders) {
    const orderId = String(ps.id ?? "");
    const reference = ps.reference ?? "";
    const state = ps.current_state ?? "?";
    const stateLabel = stateLabels[state] ?? `État ${state}`;
    const total = Number.parseFloat(ps.total_paid ?? "0") || 0;
    const stripeOk = await verifyPrestaShopOrderHasStripePayment({
      orderId,
      reference,
    });

    const marker = stripeOk
      ? "✓ Stripe"
      : isPrestaShopPaidState(state)
        ? "⚠ SANS Stripe"
        : "  ";
    console.log(
      `  ${marker} | PS#${orderId} | ${reference} | ${total.toFixed(2)} € | ${stateLabel}`,
    );

    if (isPrestaShopPaidState(state) && !stripeOk) {
      phantomPaid.push(`${reference} (PS#${orderId}, ${total.toFixed(2)} €)`);
    }
  }

  for (const session of paidSessions) {
    const orderId = session.orderId?.trim();
    if (!orderId) continue;
    const ps = psOrders.find((o) => String(o.id) === orderId);
    if (!ps) {
      stripeMissingFulfillment.push(
        `${session.reference ?? "?"} (PS#${orderId}, ${session.amount.toFixed(2)} €, ${session.email})`,
      );
      continue;
    }
    if (!isPrestaShopPaidState(ps.current_state)) {
      stripeMissingFulfillment.push(
        `${session.reference ?? "?"} (PS#${orderId}, payé Stripe mais PS état ${ps.current_state})`,
      );
    }
  }

  console.log("\n=== RÉSUMÉ ===\n");
  console.log(`Fiez-vous à Stripe pour l'argent reçu : ${paidSessions.length} paiement(s).`);
  console.log(
    "PrestaShop crée une commande à chaque tentative de checkout, même si le paiement échoue.\n",
  );

  if (phantomPaid.length) {
    console.log("⚠ Commandes PrestaShop « payées » SANS paiement Stripe (ne pas expédier) :");
    for (const line of phantomPaid) console.log(`   - ${line}`);
    console.log("");
  } else {
    console.log("✓ Aucune commande PrestaShop payée sans Stripe détectée.\n");
  }

  if (stripeMissingFulfillment.length) {
    console.log("⚠ Paiements Stripe OK mais commande PrestaShop mal synchronisée :");
    for (const line of stripeMissingFulfillment) console.log(`   - ${line}`);
    console.log("");
  } else {
    console.log("✓ Tous les paiements Stripe ont une commande PrestaShop cohérente.\n");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
