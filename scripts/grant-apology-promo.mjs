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
const baseUrl = (
  process.env.GRANT_PROMO_BASE_URL?.trim() ||
  process.env.SITE_URL?.trim() ||
  "https://foot-shop.fr"
).replace(/\/$/, "");

const defaultEmails = [
  "marlene.rossignol5@gmail.com",
  "alex.lehegarat.1822@gmail.com",
  "ilhanotmane@gmail.com",
];

const emails = process.argv.slice(2).length
  ? process.argv.slice(2)
  : defaultEmails;

if (!secret) {
  console.error("ADMIN_SECRET manquant dans .env.local");
  process.exit(2);
}

const res = await fetch(`${baseUrl}/api/admin/customer-promo`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ emails }),
});

const body = await res.json();
console.log("HTTP", res.status);
console.log(JSON.stringify(body, null, 2));
process.exit(res.ok ? 0 : 1);
