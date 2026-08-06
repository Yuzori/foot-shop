/**
 * Envoie un exemplaire de test de chaque email transactionnel.
 *
 * Usage :
 *   npx tsx scripts/test-emails.ts vous@example.com
 *
 * Variables d'environnement : .env.local (RESEND_API_KEY ou SMTP_*)
 */
import Module from "node:module";
import fs from "node:fs";
import path from "node:path";

// Permet d'importer les modules server-only hors Next.js.
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
  const content = fs.readFileSync(full, "utf8");
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
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

async function main(): Promise<void> {
  const to = process.argv[2]?.trim();
  if (!to) {
    console.error("Usage: npx tsx scripts/test-emails.ts <email>");
    process.exit(1);
  }

  const { runAllEmailTests } = await import("../lib/test-all-emails");
  const { mailConfig } = await import("../config/mail");

  console.log(`Provider: ${mailConfig.provider} (enabled=${mailConfig.enabled})`);
  console.log(`Envoi des tests vers ${to}…\n`);

  const report = await runAllEmailTests(to, { delayMs: 400 });

  for (const row of report.results) {
    const status = row.devMode
      ? "DEV (non configuré)"
      : row.delivered
        ? "OK"
        : `ÉCHEC${row.error ? ` — ${row.error}` : ""}`;
    console.log(`[${status}] ${row.label}`);
  }

  console.log(
    `\nRésumé : ${report.passed}/${report.results.length} envoyés, ${report.failed} échec(s).`,
  );

  if (!mailConfig.enabled) {
    process.exit(2);
  }
  if (report.failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
