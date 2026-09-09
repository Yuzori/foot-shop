import fs from "node:fs";
import path from "node:path";

function loadEnvFile(file) {
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

const secret = process.env.ADMIN_SECRET?.trim();
const reference = process.argv[2]?.trim() || "MFHTJWABT";

const res = await fetch("https://foot-shop.fr/api/admin/order-archive?limit=500", {
  headers: { Authorization: `Bearer ${secret}` },
});
const data = await res.json();
const hit = (data.records ?? []).find((r) => r.reference === reference);
if (!hit) {
  console.log("Commande introuvable dans l'archive.");
  process.exit(1);
}
console.log(JSON.stringify(hit, null, 2));
