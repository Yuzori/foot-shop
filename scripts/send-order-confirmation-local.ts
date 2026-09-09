/**
 * Envoie le récap commande (local, via API mail du projet).
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
    console.error("Usage: npx tsx scripts/send-order-confirmation-local.ts <reference> <email>");
    process.exit(1);
  }
  if (!secret) {
    console.error("ADMIN_SECRET manquant");
    process.exit(2);
  }

  const base = (process.env.PROD_SITE_URL ?? "https://foot-shop.fr").replace(/\/$/, "");
  const listRes = await fetch(`${base}/api/admin/order-archive?limit=500`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const listData = (await listRes.json()) as {
    records?: Array<{ id: string; reference: string }>;
  };
  const summary = listData.records?.find((r) => r.reference === reference);
  if (!summary) {
    console.error("Archive introuvable pour", reference);
    process.exit(1);
  }

  const recordRes = await fetch(
    `${base}/api/admin/order-archive?id=${encodeURIComponent(summary.id)}`,
    { headers: { Authorization: `Bearer ${secret}` } },
  );
  const recordData = (await recordRes.json()) as { record?: unknown };
  if (!recordData.record) {
    console.error("Détail archive introuvable");
    process.exit(1);
  }

  const { prestashop } = await import("../services/prestashop");
  const { enrichOrderArchiveForEmail } = await import("../lib/enrich-order-archive-for-email");
  const { sendOrderConfirmationEmail } = await import("../lib/order-confirmation-email");
  type OrderArchiveRecord = import("../lib/order-archive-store").OrderArchiveRecord;

  const order = await prestashop.getOrderByReference(reference);
  if (!order) {
    console.error("Commande PrestaShop introuvable");
    process.exit(1);
  }

  const archive = recordData.record as OrderArchiveRecord;
  const emailArchive = await enrichOrderArchiveForEmail(archive, order.id);

  await sendOrderConfirmationEmail({
    to,
    order,
    archive: emailArchive,
    firstName: emailArchive?.contact.firstName,
  });

  console.log(`OK — récap ${reference} envoyé à ${to}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
