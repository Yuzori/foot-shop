const pages = [
  "https://www.unisportstore.fr/boutique-cm/",
  "https://www.unisportstore.fr/maillots-de-football/101-france/",
  "https://www.unisportstore.fr/maillots-de-football/107-bresil/",
  "https://www.unisportstore.fr/maillots-de-football/118-japon/",
  "https://www.unisportstore.fr/maillots-de-football/120-etats-unis/",
  "https://www.unisportstore.fr/maillots-de-football/244-mexique/",
  "https://www.unisportstore.fr/maillots-de-football/248-colombie/",
  "https://www.unisportstore.fr/maillots-de-football/122-coree-du-sud/",
  "https://www.unisportstore.fr/maillots-de-football/1665-chili/",
  "https://www.unisportstore.fr/maillots-de-football/424-maroc/",
  "https://www.unisportstore.fr/maillots-de-football/239-argentine/",
  "https://www.unisportstore.fr/maillots-de-football/128-portugal/",
  "https://www.unisportstore.fr/maillots-de-football/14-equipes-nationales/",
];

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const all = new Map();

for (const p of pages) {
  const html = await fetch(p, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "fr-FR" },
  }).then((r) => r.text());
  const re =
    /href="(\/(?:maillots-de-football|t-shirts)\/[^"#?]+\/\d+\/?)"/gi;
  let m;
  while ((m = re.exec(html))) {
    const slug = m[1].split("/")[2];
    all.set(
      slug,
      "https://www.unisportstore.fr" + m[1].replace(/\/$/, "") + "/"
    );
  }
  await new Promise((r) => setTimeout(r, 150));
}

const lines = [...all.entries()]
  .filter(([k]) => /2026|202526|202627/.test(k))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, v]) => `${k} -> ${v}`);

writeFileSync(join(__dirname, "scraped-team-links.txt"), lines.join("\n"), "utf8");
console.log("wrote", lines.length, "links");
