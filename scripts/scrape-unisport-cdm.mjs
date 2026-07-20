const teamPages = [
  "https://www.unisportstore.fr/maillots-de-football/maillots-de-football-de-la-plus-grande-competition-de-football/",
  "https://www.unisportstore.fr/boutique-cm/",
  "https://www.unisportstore.fr/maillots-de-football/14-equipes-nationales/",
  "https://www.unisportstore.fr/maillots-de-football/239-argentine/",
  "https://www.unisportstore.fr/maillots-de-football/106-allemagne/",
  "https://www.unisportstore.fr/maillots-de-football/105-italie/",
  "https://www.unisportstore.fr/maillots-de-football/128-portugal/",
  "https://www.unisportstore.fr/maillots-de-football/3774-suede/",
  "https://www.unisportstore.fr/maillots-de-football/2878-croatie/",
  "https://www.unisportstore.fr/maillots-de-football/3165-pologne/",
  "https://www.unisportstore.fr/maillots-de-football/1665-chile/",
  "https://www.unisportstore.fr/maillots-de-football/706-nigeria/",
  "https://www.unisportstore.fr/maillots-de-football/424-marokko/",
  "https://www.unisportstore.fr/maillots-de-football/136-turquie/",
  "https://www.unisportstore.fr/maillots-de-football/122-sydkorea/",
  "https://www.unisportstore.fr/maillots-de-football/101-frankrig/",
  "https://www.unisportstore.fr/maillots-de-football/107-brasilien/",
  "https://www.unisportstore.fr/maillots-de-football/118-japan/",
  "https://www.unisportstore.fr/maillots-de-football/120-usa/",
  "https://www.unisportstore.fr/maillots-de-football/244-mexiko/",
  "https://www.unisportstore.fr/maillots-de-football/248-kolumbien/",
  "https://www.unisportstore.fr/maillots-de-football/461740-norvege/",
  "https://www.unisportstore.fr/maillots-de-football/3774-suede/",
  "https://www.unisportstore.fr/maillots-de-football/424-marokko/",
  "https://www.unisportstore.fr/maillots-de-football/3165-pologne/",
  "https://www.unisportstore.fr/maillots-de-football/1665-chile/",
  "https://www.unisportstore.fr/maillots-de-football/122-sydkorea/",
  "https://www.unisportstore.fr/maillots-de-football/136-turquie/",
  "https://www.unisportstore.fr/maillots-de-football/706-nigeria/",
  "https://www.unisportstore.fr/maillots-de-football/2878-croatie/",
  "https://www.unisportstore.fr/maillots-de-football/128-portugal/",
  "https://www.unisportstore.fr/maillots-de-football/105-italie/",
  "https://www.unisportstore.fr/maillots-de-football/106-allemagne/",
  "https://www.unisportstore.fr/maillots-de-football/239-argentine/",
  "https://www.unisportstore.fr/maillots-de-football/107-brasilien/",
  "https://www.unisportstore.fr/maillots-de-football/101-frankrig/",
  "https://www.unisportstore.fr/maillots-de-football/118-japan/",
  "https://www.unisportstore.fr/maillots-de-football/120-usa/",
  "https://www.unisportstore.fr/maillots-de-football/244-mexiko/",
  "https://www.unisportstore.fr/maillots-de-football/248-kolumbien/",
  "https://www.unisportstore.fr/maillots-de-football/3165-pologne/",
  "https://www.unisportstore.fr/maillots-de-football/1665-chile/",
  "https://www.unisportstore.fr/maillots-de-football/122-sydkorea/",
  "https://www.unisportstore.fr/maillots-de-football/136-turquie/",
  "https://www.unisportstore.fr/maillots-de-football/706-nigeria/",
  "https://www.unisportstore.fr/maillots-de-football/2878-croatie/",
  "https://www.unisportstore.fr/maillots-de-football/128-portugal/",
  "https://www.unisportstore.fr/maillots-de-football/105-italie/",
  "https://www.unisportstore.fr/maillots-de-football/106-allemagne/",
  "https://www.unisportstore.fr/maillots-de-football/239-argentine/",
  "https://www.unisportstore.fr/maillots-de-football/107-brasilien/",
  "https://www.unisportstore.fr/maillots-de-football/101-frankrig/",
];

// Also try French slugs for teams
const frPages = [
  "https://www.unisportstore.fr/maillots-de-football/101-france/",
  "https://www.unisportstore.fr/maillots-de-football/107-bresil/",
  "https://www.unisportstore.fr/maillots-de-football/118-japon/",
  "https://www.unisportstore.fr/maillots-de-football/120-etats-unis/",
  "https://www.unisportstore.fr/maillots-de-football/244-mexique/",
  "https://www.unisportstore.fr/maillots-de-football/248-colombie/",
  "https://www.unisportstore.fr/maillots-de-football/3165-pologne/",
  "https://www.unisportstore.fr/maillots-de-football/1665-chili/",
  "https://www.unisportstore.fr/maillots-de-football/122-coree-du-sud/",
  "https://www.unisportstore.fr/maillots-de-football/136-turquie/",
  "https://www.unisportstore.fr/maillots-de-football/706-nigeria/",
  "https://www.unisportstore.fr/maillots-de-football/424-maroc/",
  "https://www.unisportstore.fr/maillots-de-football/3774-suede/",
  "https://www.unisportstore.fr/maillots-de-football/128-portugal/",
  "https://www.unisportstore.fr/maillots-de-football/105-italie/",
  "https://www.unisportstore.fr/maillots-de-football/106-allemagne/",
  "https://www.unisportstore.fr/maillots-de-football/239-argentine/",
  "https://www.unisportstore.fr/maillots-de-football/2878-croatie/",
  "https://www.unisportstore.fr/maillots-de-football/3165-pologne/",
  "https://www.unisportstore.fr/maillots-de-football/1665-chili/",
  "https://www.unisportstore.fr/maillots-de-football/122-coree-du-sud/",
  "https://www.unisportstore.fr/maillots-de-football/136-turquie/",
  "https://www.unisportstore.fr/maillots-de-football/706-nigeria/",
  "https://www.unisportstore.fr/maillots-de-football/424-maroc/",
  "https://www.unisportstore.fr/maillots-de-football/3774-suede/",
  "https://www.unisportstore.fr/maillots-de-football/128-portugal/",
  "https://www.unisportstore.fr/maillots-de-football/105-italie/",
  "https://www.unisportstore.fr/maillots-de-football/106-allemagne/",
  "https://www.unisportstore.fr/maillots-de-football/239-argentine/",
  "https://www.unisportstore.fr/maillots-de-football/107-bresil/",
  "https://www.unisportstore.fr/maillots-de-football/101-france/",
  "https://www.unisportstore.fr/maillots-de-football/118-japon/",
  "https://www.unisportstore.fr/maillots-de-football/120-etats-unis/",
  "https://www.unisportstore.fr/maillots-de-football/244-mexique/",
  "https://www.unisportstore.fr/maillots-de-football/248-colombie/",
  "https://www.unisportstore.fr/maillots-de-football/3165-pologne/",
  "https://www.unisportstore.fr/maillots-de-football/1665-chili/",
  "https://www.unisportstore.fr/maillots-de-football/122-coree-du-sud/",
  "https://www.unisportstore.fr/maillots-de-football/136-turquie/",
  "https://www.unisportstore.fr/maillots-de-football/706-nigeria/",
  "https://www.unisportstore.fr/maillots-de-football/424-maroc/",
  "https://www.unisportstore.fr/maillots-de-football/3774-suede/",
  "https://www.unisportstore.fr/maillots-de-football/128-portugal/",
  "https://www.unisportstore.fr/maillots-de-football/105-italie/",
  "https://www.unisportstore.fr/maillots-de-football/106-allemagne/",
  "https://www.unisportstore.fr/maillots-de-football/239-argentine/",
  "https://www.unisportstore.fr/maillots-de-football/107-bresil/",
  "https://www.unisportstore.fr/maillots-de-football/101-france/",
  "https://www.unisportstore.fr/maillots-de-football/118-japon/",
  "https://www.unisportstore.fr/maillots-de-football/120-etats-unis/",
  "https://www.unisportstore.fr/maillots-de-football/244-mexique/",
  "https://www.unisportstore.fr/maillots-de-football/248-colombie/",
  "https://www.unisportstore.fr/maillots-de-football/3165-pologne/",
  "https://www.unisportstore.fr/maillots-de-football/1665-chili/",
  "https://www.unisportstore.fr/maillots-de-football/122-coree-du-sud/",
  "https://www.unisportstore.fr/maillots-de-football/136-turquie/",
  "https://www.unisportstore.fr/maillots-de-football/706-nigeria/",
  "https://www.unisportstore.fr/maillots-de-football/424-maroc/",
  "https://www.unisportstore.fr/maillots-de-football/3774-suede/",
  "https://www.unisportstore.fr/maillots-de-football/128-portugal/",
  "https://www.unisportstore.fr/maillots-de-football/105-italie/",
  "https://www.unisportstore.fr/maillots-de-football/106-allemagne/",
  "https://www.unisportstore.fr/maillots-de-football/239-argentine/",
  "https://www.unisportstore.fr/maillots-de-football/107-bresil/",
  "https://www.unisportstore.fr/maillots-de-football/101-france/",
];

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pages = [...new Set([...teamPages, ...frPages])];

async function fetchHtml(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "fr-FR,fr;q=0.9",
    },
  });
  return r.ok ? r.text() : "";
}

const all = new Map();
for (const p of pages) {
  const html = await fetchHtml(p);
  const re =
    /href="(\/(?:maillots-de-football|t-shirts)\/[^"#?]+\/\d+\/?)"/gi;
  let m;
  while ((m = re.exec(html))) {
    const full =
      "https://www.unisportstore.fr" + m[1].replace(/\/$/, "") + "/";
    const slug = m[1].split("/")[2];
    if (!all.has(slug)) all.set(slug, full);
  }
  await new Promise((r) => setTimeout(r, 150));
}

const out = Object.fromEntries(all);
writeFileSync(
  join(__dirname, "unisport-catalog.json"),
  JSON.stringify(out, null, 2),
  "utf8"
);
console.log("saved", all.size, "products");
