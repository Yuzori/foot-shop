import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { normalizeJerseyProductName } from "@/lib/product-import/format-product-name";
import { prestashop } from "@/services/prestashop";

const MIGRATION_ID = "product-names-season-v1";
const FLAG_PATH = path.join(process.cwd(), ".data", `${MIGRATION_ID}.done`);

let migrationPromise: Promise<void> | null = null;

async function isMigrationDone(): Promise<boolean> {
  try {
    await readFile(FLAG_PATH, "utf8");
    return true;
  } catch {
    return false;
  }
}

async function markMigrationDone(summary: {
  scanned: number;
  updated: number;
  skipped: number;
}): Promise<void> {
  await mkdir(path.dirname(FLAG_PATH), { recursive: true });
  await writeFile(
    FLAG_PATH,
    JSON.stringify({ finishedAt: new Date().toISOString(), ...summary }, null, 2),
    "utf8",
  );
}

async function runMigration(): Promise<void> {
  if (!prestashop.isConfigured) return;

  const products = await prestashop.listAllProductNames({ includeInactive: true });
  let updated = 0;
  let skipped = 0;

  for (const product of products) {
    const nextName = normalizeJerseyProductName(product.name);
    if (!nextName || nextName === product.name) {
      skipped += 1;
      continue;
    }

    try {
      await prestashop.updateProductName(product.id, nextName);
      updated += 1;
    } catch (error) {
      console.error(
        `[migration:${MIGRATION_ID}] product=${product.id} failed`,
        error,
      );
    }
  }

  await markMigrationDone({
    scanned: products.length,
    updated,
    skipped,
  });

  console.info(
    `[migration:${MIGRATION_ID}] done scanned=${products.length} updated=${updated} skipped=${skipped}`,
  );
}

/** Renomme une fois tous les maillots en base PrestaShop (saison 25-26). */
export async function ensureProductNamesNormalized(): Promise<void> {
  if (!prestashop.isConfigured) return;
  if (await isMigrationDone()) return;

  if (!migrationPromise) {
    migrationPromise = runMigration()
      .catch((error) => {
        console.error(`[migration:${MIGRATION_ID}] failed`, error);
      })
      .finally(() => {
        migrationPromise = null;
      });
  }

  await migrationPromise;
}
