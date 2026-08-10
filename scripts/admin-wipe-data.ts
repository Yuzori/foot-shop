/**
 * Vide tout l'historique admin (archives, expéditions, brouillons BBDBuy).
 * Usage : npm run admin:wipe
 */
import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";

/** Permet d'exécuter le script CLI hors Next.js (stores importent server-only). */
function stubServerOnly(): void {
  const require = createRequire(import.meta.url);
  const resolved = require.resolve("server-only");
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: {},
  } as NodeModule;
}

stubServerOnly();

const FLAG_FILE = path.join(process.cwd(), ".data", ".order-admin-full-reset-v1");

async function main() {
  const { purgeAllOrderArchives } = await import("../lib/order-archive-store");
  const { purgeAllShippingEntries } = await import("../lib/order-shipping-store");
  const { purgeAllSupplierDrafts } = await import("../lib/supplier-order-store");

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
