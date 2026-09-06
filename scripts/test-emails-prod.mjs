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
const to = process.argv[2]?.trim() || "contact@foot-shop.fr";

if (!secret) {
  console.error("ADMIN_SECRET manquant dans .env.local");
  process.exit(2);
}

const res = await fetch("https://foot-shop.fr/api/admin/test-emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ to, delayMs: 2000 }),
});

const body = await res.json();
console.log("HTTP", res.status);
console.log(JSON.stringify(body, null, 2));
process.exit(res.ok && body.failed === 0 ? 0 : 1);
