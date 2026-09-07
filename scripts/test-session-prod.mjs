/**
 * Test création session Stripe sur prod (sans payer).
 * Usage: node scripts/test-session-prod.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

loadEnv();

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://foot-shop.fr").replace(/\/$/, "");
const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
const suffix = Date.now().toString(36).toUpperCase();

const payload = {
  contact: {
    firstName: "Test",
    lastName: "Paiement",
    email: `test.paiement.${suffix}@gmail.com`,
    phone: "0601020304",
  },
  address: {
    address1: "10 rue de Rivoli",
    postcode: "75001",
    city: "Paris",
    country: "France",
  },
  lines: [
    {
      productId: "462",
      variantId: null,
      quantity: 1,
      unitPrice: 25.99,
      name: "Maillot Espagne Domicile 2026",
      optionsLabel: "Taille: M",
    },
  ],
  items: [{ name: "Maillot Espagne Domicile 2026", unitPrice: 25.99, quantity: 1 }],
};

async function main() {
  const res = await fetch(`${BASE}/api/checkout/stripe/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  console.log("HTTP", res.status);
  if (!res.ok) {
    console.log(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log("reference:", data.reference);
  console.log("session:", data.checkoutSessionId);
  console.log("returnUrl:", data.returnUrl);

  if (!stripeKey.startsWith("sk_")) {
    console.log("Pas de STRIPE_SECRET_KEY locale — arrêt.");
    return;
  }

  const require = createRequire(import.meta.url);
  const Stripe = require("stripe");
  const stripe = new Stripe(stripeKey);

  const session = await stripe.checkout.sessions.retrieve(data.checkoutSessionId, {
    expand: ["line_items", "payment_intent"],
  });

  console.log("status:", session.status, "payment:", session.payment_status);
  console.log("amount_total:", session.amount_total, session.currency);
  console.log("metadata keys:", Object.keys(session.metadata ?? {}).length);
  console.log("metadata:", JSON.stringify(session.metadata, null, 2));

  const lineItems = await stripe.checkout.sessions.listLineItems(data.checkoutSessionId, {
    limit: 10,
  });
  let sum = 0;
  for (const item of lineItems.data) {
    const lineTotal = (item.amount_total ?? 0);
    sum += lineTotal;
    console.log(
      `  line: ${item.description ?? item.price?.product} qty=${item.quantity} total=${lineTotal}`,
    );
  }
  console.log("line_items sum:", sum, "session amount:", session.amount_total);
  if (sum !== session.amount_total) {
    console.error("MISMATCH line items vs session total!");
  }

  const pi = session.payment_intent;
  if (pi && typeof pi !== "string") {
    console.log("payment_intent status:", pi.status, "amount:", pi.amount);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
