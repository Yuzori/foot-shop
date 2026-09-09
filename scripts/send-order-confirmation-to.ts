/**
 * Envoie une copie du récap commande vers une adresse (prod).
 *
 * Usage :
 *   npx tsx scripts/send-order-confirmation-to.ts MFHTJWABT vous@example.com
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
  const reference = process.argv[2]?.trim();
  const to = process.argv[3]?.trim();
  const secret = process.env.ADMIN_SECRET?.trim();

  if (!reference || !to) {
    console.error("Usage: npx tsx scripts/send-order-confirmation-to.ts <reference> <email>");
    process.exit(1);
  }
  if (!secret) {
    console.error("ADMIN_SECRET manquant dans .env.local");
    process.exit(2);
  }

  const base = (process.env.PROD_SITE_URL ?? "https://foot-shop.fr").replace(/\/$/, "");
  const res = await fetch(`${base}/api/admin/repair-orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "resend_customer_email",
      references: [reference],
      to,
    }),
  });

  const body = await res.json().catch(() => ({}));
  console.log("HTTP", res.status);
  console.log(JSON.stringify(body, null, 2));
  if (!res.ok || !body.sent) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
