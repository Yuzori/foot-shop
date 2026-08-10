/**
 * Vide tout l'historique admin (archives, expéditions, brouillons BBDBuy).
 * Usage : npx tsx scripts/admin-wipe-data.ts
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import { purgeAllOrderArchives } from "../lib/order-archive-store";
import { purgeAllShippingEntries } from "../lib/order-shipping-store";
import { purgeAllSupplierDrafts } from "../lib/supplier-order-store";

const FLAG_FILE = path.join(process.cwd(), ".data", ".order-admin-full-reset-v1");

async function main() {
  const [archives, shipping, supplier] = await Promise.all([
    purgeAllOrderArchives(),
    purgeAllShippingEntries(),
    purgeAllSupplierDrafts(),
  ]);
  await fs.mkdir(path.dirname(FLAG_FILE), { recursive: true });
  await fs.writeFile(FLAG_FILE, new Date().toISOString(), "utf8");
  console.log(
    `Admin vidé : ${archives.removed} archive(s), ${shipping.removed} expédition(s), ${supplier.removed} brouillon(s).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
