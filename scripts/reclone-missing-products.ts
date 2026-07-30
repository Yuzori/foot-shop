/**
 * Re-clone les produits PrestaShop invisibles dans le BO (hors ~207 déjà listables).
 *
 * Usage :
 *   npx tsx scripts/reclone-missing-products.ts --dry-run
 *   npx tsx scripts/reclone-missing-products.ts --limit=10
 *   npx tsx scripts/reclone-missing-products.ts --deactivate-source
 *
 * Variables : PRESTASHOP_API_URL, PRESTASHOP_API_KEY, PRESTASHOP_SHOP_ID (dans .env ou .env.local)
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Permet d'exécuter le script CLI hors Next.js (prestashop importe server-only). */
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

function loadEnvFile(fileName: string, override: boolean): void {
  const envPath = path.join(process.cwd(), fileName);
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
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
    if (override || !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function loadEnvFiles(): void {
  loadEnvFile(".env", false);
  loadEnvFile(".env.local", true);
  if (!process.env.PRESTASHOP_API_URL) {
    console.warn(
      "[reclone] PRESTASHOP_API_URL manquant — vérifiez .env ou .env.local.",
    );
  }
}

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const deactivateSource = argv.includes("--deactivate-source");
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  const delayArg = argv.find((arg) => arg.startsWith("--delay="));
  const limit = limitArg ? Number.parseInt(limitArg.split("=")[1] ?? "", 10) : 0;
  const delayMs = delayArg
    ? Number.parseInt(delayArg.split("=")[1] ?? "", 10)
    : 800;
  return {
    dryRun,
    deactivateSource,
    limit: Number.isFinite(limit) && limit > 0 ? limit : 0,
    delayMs: Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 800,
  };
}

async function main(): Promise<void> {
  stubServerOnly();
  loadEnvFiles();
  const args = parseArgs(process.argv.slice(2));

  const { scanProductsToReclone, recloneMissingProducts } = await import(
    "../lib/migrations/reclone-missing-products"
  );

  console.info("[reclone] Scan du catalogue PrestaShop…");
  const scan = await scanProductsToReclone();

  console.info(`[reclone] Total produits API     : ${scan.totalProducts}`);
  console.info(`[reclone] Déjà visibles BO       : ${scan.boListable}`);
  console.info(`[reclone] Déjà clonés (manifest) : ${scan.alreadyCloned}`);
  console.info(`[reclone] Ignorés (prix 0)      : ${scan.skippedNoPrice}`);
  console.info(`[reclone] Ignorés (sans image)  : ${scan.skippedNoImages}`);
  console.info(`[reclone] Ignorés (nom en BO)   : ${scan.skippedDuplicateName}`);
  console.info(`[reclone] À cloner              : ${scan.candidates.length}`);

  if (scan.candidates.length > 0) {
    console.info("[reclone] Échantillon :");
    for (const row of scan.candidates.slice(0, 15)) {
      console.info(
        `  - #${row.id} | ${row.price.toFixed(2)} € | ${row.imageCount} img | ${row.name}`,
      );
    }
    if (scan.candidates.length > 15) {
      console.info(`  … et ${scan.candidates.length - 15} autres`);
    }
  }

  if (args.dryRun) {
    console.info("[reclone] Mode --dry-run : aucun produit créé.");
    return;
  }

  if (scan.candidates.length === 0) {
    console.info("[reclone] Rien à cloner.");
    return;
  }

  const limit = args.limit || scan.candidates.length;
  console.info(
    `[reclone] Lancement clonage (limit=${limit}, delay=${args.delayMs}ms, deactivateSource=${args.deactivateSource})…`,
  );

  const result = await recloneMissingProducts({
    dryRun: false,
    limit,
    delayMs: args.delayMs,
    deactivateSource: args.deactivateSource,
    scan,
  });

  console.info(`[reclone] Terminé — clonés: ${result.cloned}, échecs: ${result.failed}`);
  if (result.errors.length > 0) {
    console.info("[reclone] Erreurs :");
    for (const err of result.errors) {
      console.info(`  - #${err.sourceId} "${err.name}" : ${err.error}`);
    }
  }
  console.info("[reclone] Manifest : .data/reclone-manifest.json");
  console.info("[reclone] Pense à vider le cache PrestaShop (Performances → Vider le cache).");
}

main().catch((error) => {
  console.error("[reclone] Fatal:", error);
  process.exit(1);
});
