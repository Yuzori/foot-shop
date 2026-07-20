import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const xml = await fetch("https://www.unisportstore.fr/sitemap-products.xml", {
  headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "fr-FR" },
}).then((r) => r.text());

const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const catalog = {};
for (const url of urls) {
  const m = url.match(
    /unisportstore\.fr\/(?:maillots-de-football|t-shirts)\/([^/]+)\/(\d+)/
  );
  if (m) catalog[m[1]] = url.endsWith("/") ? url : url + "/";
}

writeFileSync(
  join(__dirname, "unisport-sitemap-catalog.json"),
  JSON.stringify(catalog, null, 2),
  "utf8"
);
console.log("products", Object.keys(catalog).length);
