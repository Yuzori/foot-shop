/**
 * Vide tout l'historique admin (archives, expéditions, brouillons BBDBuy).
 * Usage : npm run admin:wipe  (Node pur, sans tsx)
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ARCHIVE_DIR = path.join(ROOT, ".data", "order-archives");
const INDEX_FILE = path.join(ARCHIVE_DIR, "_index.json");
const SHIPPING_FILE = path.join(ROOT, ".data", "order-shipping.json");
const SUPPLIER_DIR = path.join(ROOT, ".data", "supplier-orders");
const FLAG_FILE = path.join(ROOT, ".data", ".order-admin-full-reset-v1");

async function purgeArchives() {
  let removed = 0;
  try {
    const raw = await fs.readFile(INDEX_FILE, "utf8");
    const index = JSON.parse(raw);
    if (Array.isArray(index)) {
      removed = index.length;
      for (const record of index) {
        const id = String(record?.id ?? "").replace(/[^\w-]/g, "");
        if (!id) continue;
        await fs.unlink(path.join(ARCHIVE_DIR, `${id}.json`)).catch(() => {});
      }
    }
  } catch {
    /* empty */
  }
  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
  await fs.writeFile(INDEX_FILE, "[]", "utf8");
  return removed;
}

async function purgeShipping() {
  let removed = 0;
  try {
    const raw = await fs.readFile(SHIPPING_FILE, "utf8");
    const items = JSON.parse(raw);
    if (Array.isArray(items)) removed = items.length;
  } catch {
    /* empty */
  }
  await fs.mkdir(path.dirname(SHIPPING_FILE), { recursive: true });
  await fs.writeFile(SHIPPING_FILE, "[]", "utf8");
  return removed;
}

async function purgeSupplierDrafts() {
  let removed = 0;
  try {
    const files = await fs.readdir(SUPPLIER_DIR);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      await fs.unlink(path.join(SUPPLIER_DIR, file));
      removed += 1;
    }
  } catch {
    /* empty */
  }
  return removed;
}

async function main() {
  const [archives, shipping, supplier] = await Promise.all([
    purgeArchives(),
    purgeShipping(),
    purgeSupplierDrafts(),
  ]);

  await fs.mkdir(path.dirname(FLAG_FILE), { recursive: true });
  await fs.writeFile(FLAG_FILE, new Date().toISOString(), "utf8");

  console.log(
    `Admin vidé : ${archives} archive(s), ${shipping} expédition(s), ${supplier} brouillon(s).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
