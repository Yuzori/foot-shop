/**
 * Résout des liens produits → équivalent Unisport (recherche site).
 * Usage: node scripts/resolve-unisport-links.mjs [fichier.txt]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const UNISPORT_HOST = "unisportstore.fr";
const SEARCH_BASE = "https://www.unisportstore.fr/recherche/?q=";

const TEAM_SLUG = {
  espagne: "espagne",
  spain: "espagne",
  france: "france",
  argentine: "argentine",
  argentina: "argentine",
  bresil: "bresil",
  brazil: "bresil",
  brasil: "bresil",
  portugal: "portugal",
  angleterre: "angleterre",
  england: "angleterre",
  italie: "italie",
  italy: "italie",
  allemagne: "allemagne",
  germany: "allemagne",
  belgique: "belgique",
  belgium: "belgique",
  paysbas: "pays-bas",
  netherlands: "pays-bas",
  holland: "pays-bas",
  norvege: "norvege",
  norway: "norvege",
  suede: "suede",
  sweden: "suede",
  japon: "japon",
  japan: "japon",
  croatie: "croatie",
  croatia: "croatie",
  mexique: "mexique",
  mexico: "mexique",
  usa: "usa",
  etatsunis: "usa",
  "etats-unis": "usa",
  colombie: "colombie",
  colombia: "colombie",
  nigeria: "nigeria",
  maroc: "maroc",
  morocco: "maroc",
  algerie: "algerie",
  algeria: "algerie",
  pologne: "pologne",
  poland: "poland",
  pologne2: "pologne",
  chili: "chili",
  chile: "chili",
  turquie: "turkey",
  turkey: "turquie",
  ghana: "ghana",
  curacao: "curacao",
  curaçao: "curacao",
  canada: "canada",
  coree: "coree-du-sud",
  korea: "coree-du-sud",
  "costa-rica": "costa-rica",
  costarica: "costa-rica",
  "afrique-du-sud": "afrique-du-sud",
  "south-africa": "afrique-du-sud",
  "republique-democratique-du-congo": "rd-congo",
  "rd-congo": "rd-congo",
  congo: "rd-congo",
  rdc: "rd-congo",
};

function stripAccents(s) {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function normToken(s) {
  return stripAccents(s.toLowerCase()).replace(/[^a-z0-9]+/g, "");
}

function cleanUnisportUrl(url) {
  try {
    const u = new URL(url.split("#")[0]);
    if (!u.hostname.includes(UNISPORT_HOST)) return null;
    const path = u.pathname.replace(/\/$/, "");
    const m = path.match(/^(.*\/maillots-de-football\/[^/]+\/\d+)/i);
    if (m) return `https://www.unisportstore.fr${m[1]}/`;
    const m2 = path.match(/^(.*\/t-shirts\/[^/]+\/\d+)/i);
    if (m2) return `https://www.unisportstore.fr${m2[1]}/`;
    return u.origin + path + "/";
  } catch {
    return null;
  }
}

function isUnisport(url) {
  try {
    return new URL(url).hostname.includes(UNISPORT_HOST);
  } catch {
    return false;
  }
}

function parseUrlsFromText(raw) {
  const re = /https?:\/\/[^\s<>"')\]},]+/gi;
  const seen = new Set();
  const out = [];
  for (const m of raw.match(re) ?? []) {
    let u = m.replace(/[)\]}>"',.;:]+$/g, "").trim();
    try {
      u = new URL(u).toString();
    } catch {
      continue;
    }
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function detectKit(text) {
  const t = text.toLowerCase();
  if (/\b(third|troisieme|troisième|3e|3ème|thd|alternatif)\b/.test(t)) return "third";
  if (/\b(away|exterieur|extérieur|exterior|ext|auswarts)\b/.test(t)) return "exterieur";
  if (/\b(gardien|goalkeeper|gk|gkd)\b/.test(t)) return "gardien";
  if (/\b(home|domicile|dom|principal|interieur|intérieur)\b/.test(t)) return "domicile";
  return "domicile";
}

function detectTeamSlug(hay) {
  const tokens = stripAccents(hay.toLowerCase())
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  for (const token of tokens) {
    const key = normToken(token);
    if (TEAM_SLUG[key]) return TEAM_SLUG[key];
  }

  const joined = tokens.join("-");
  for (const [key, slug] of Object.entries(TEAM_SLUG)) {
    if (joined.includes(key.replace(/2$/, "")) || joined.includes(key)) return slug;
  }

  // footcenter codes: esp26, fff26, jap26
  const code = hay.match(/\b([a-z]{2,3})26\b/i);
  if (code) {
    const map = {
      esp: "espagne",
      fff: "france",
      fra: "france",
      jap: "japon",
      cro: "croatie",
      cro26: "croatie",
      clb: "colombie",
      nor: "norvege",
      pol: "pologne",
      chl: "chili",
      usa: "usa",
      rdc: "rd-congo",
    };
    const k = code[1].toLowerCase();
    if (map[k]) return map[k];
  }

  return null;
}

function detectYear(text) {
  const m = text.match(/\b20(2[4-9]|3\d)\b/);
  if (m) return m[0];
  const season = text.match(/\b20(2[4-9])(2[4-9])\b/);
  if (season) return `20${season[2]}`;
  return "2026";
}

function extractReference(url) {
  try {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname);
    const hay = `${path} ${u.search}`;
    const team = detectTeamSlug(hay);
    const kit = detectKit(hay);
    const year = detectYear(hay);
    const wc = /world[\s-]?cup|coupe[\s-]?du[\s-]?monde|cdm|wc\s*20/i.test(hay);
    const authentic = /authentic|authentique/i.test(hay);
    const kids = /enfant|junior|kids|youth|garcon/i.test(hay);

    return { team, kit, year, wc, authentic, kids, path };
  } catch {
    return { team: null, kit: "domicile", year: "2026", wc: false, authentic: false, kids: false, path: "" };
  }
}

function buildSearchQueries(ref) {
  if (!ref.team) return ["maillot domicile 2026"];
  const queries = [];
  const teamQ = ref.team.replace(/-/g, " ");
  const kitFr =
    ref.kit === "exterieur"
      ? "exterieur"
      : ref.kit === "third"
        ? "third"
        : ref.kit === "gardien"
          ? "gardien"
          : "domicile";

  queries.push(`${teamQ} maillot ${kitFr} ${ref.year}`);
  if (ref.wc) queries.push(`${teamQ} maillot ${kitFr} coupe du monde ${ref.year}`);
  if (ref.authentic) queries.push(`${teamQ} maillot ${kitFr} authentic ${ref.year}`);
  queries.push(`${teamQ} maillot ${kitFr}`);
  return [...new Set(queries)];
}

async function searchUnisport(query) {
  const url = SEARCH_BASE + encodeURIComponent(query);
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "fr-FR,fr;q=0.9",
    },
    redirect: "follow",
  });
  if (!res.ok) return null;
  const html = await res.text();

  const links = [];
  const re = /href="(\/(?:fr\/)?maillots-de-football\/[^"?#]+\/\d+\/?)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const full = cleanUnisportUrl(`https://www.unisportstore.fr${m[1]}`);
    if (full && !links.includes(full)) links.push(full);
  }

  // Liens absolus
  const re2 = /href="(https:\/\/www\.unisportstore\.fr\/maillots-de-football\/[^"?#]+\/\d+\/?)"/gi;
  while ((m = re2.exec(html)) !== null) {
    const full = cleanUnisportUrl(m[1]);
    if (full && !links.includes(full)) links.push(full);
  }

  return links[0] ?? null;
}

function scoreCandidate(link, ref) {
  if (!ref.team) return 0;
  const slug = link.toLowerCase();
  let score = 0;
  if (slug.includes(ref.team)) score += 40;
  if (ref.kit === "exterieur" && /exterieur|away/.test(slug)) score += 25;
  if (ref.kit === "domicile" && /domicile|home/.test(slug)) score += 25;
  if (ref.kit === "third" && /third|troisieme/.test(slug)) score += 25;
  if (ref.kit === "gardien" && /gardien|goalkeeper/.test(slug)) score += 25;
  if (ref.wc && /coupe-du-monde|world-cup/.test(slug)) score += 15;
  if (ref.authentic && /authentic/.test(slug)) score += 10;
  if (slug.includes(ref.year.slice(2))) score += 10;
  if (ref.kit === "exterieur" && /domicile|home/.test(slug)) score -= 20;
  if (ref.kit === "domicile" && /exterieur|away/.test(slug)) score -= 20;
  return score;
}

async function resolveToUnisport(url) {
  const ref = extractReference(url);
  const queries = buildSearchQueries(ref);
  let best = null;
  let bestScore = -1;

  for (const q of queries) {
    const found = await searchUnisport(q);
    if (!found) continue;
    const score = scoreCandidate(found, ref);
    if (score > bestScore) {
      bestScore = score;
      best = found;
    }
    if (score >= 55) break;
    await sleep(350);
  }

  return { ref, unisport: best, queries };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const inputPath = process.argv[2] ?? join(__dirname, "unisport-input-urls.txt");

const raw = readFileSync(inputPath, "utf8");
const urls = parseUrlsFromText(raw);

const results = [];
const unisportKept = [];
const toResolve = [];

for (const url of urls) {
  if (isUnisport(url)) {
    const clean = cleanUnisportUrl(url);
    if (clean) unisportKept.push(clean);
  } else {
    toResolve.push(url);
  }
}

console.error(`Total: ${urls.length} | Unisport conservés: ${unisportKept.length} | À résoudre: ${toResolve.length}`);

for (let i = 0; i < toResolve.length; i++) {
  const url = toResolve[i];
  console.error(`[${i + 1}/${toResolve.length}] ${url.slice(0, 80)}…`);
  try {
    const { ref, unisport, queries } = await resolveToUnisport(url);
    results.push({
      source: url,
      team: ref.team,
      kit: ref.kit,
      year: ref.year,
      queries,
      unisport,
    });
    if (unisport) console.error(`  → ${unisport}`);
    else console.error(`  → NON TROUVÉ (${queries[0]})`);
  } catch (err) {
    results.push({
      source: url,
      error: err instanceof Error ? err.message : String(err),
      unisport: null,
    });
    console.error(`  → ERREUR: ${err}`);
  }
  await sleep(500);
}

const outputLines = [];
const finalUrls = [];

for (const u of unisportKept) {
  finalUrls.push(u);
}

for (const r of results) {
  if (r.unisport) finalUrls.push(r.unisport);
}

// Dédupe final
const seenFinal = new Set();
for (const u of finalUrls) {
  if (!seenFinal.has(u)) {
    seenFinal.add(u);
    outputLines.push(u);
  }
}

const reportPath = join(__dirname, "unisport-resolved-report.txt");
const linksPath = join(__dirname, "unisport-resolved-links.txt");

let report = `# Rapport résolution Unisport — ${new Date().toISOString()}\n\n`;
report += `## Liens Unisport conservés (${unisportKept.length})\n`;
for (const u of unisportKept) report += `${u}\n`;

report += `\n## Résolutions (${results.length})\n`;
for (const r of results) {
  report += `\n### Source\n${r.source}\n`;
  if (r.team) report += `Réf: ${r.team} | ${r.kit} | ${r.year}\n`;
  if (r.queries) report += `Recherche: ${r.queries.join(" | ")}\n`;
  report += r.unisport ? `✓ ${r.unisport}\n` : `✗ NON TROUVÉ\n`;
  if (r.error) report += `Erreur: ${r.error}\n`;
}

writeFileSync(linksPath, outputLines.join("\n") + "\n", "utf8");
writeFileSync(reportPath, report, "utf8");

console.error(`\nÉcrit: ${linksPath} (${outputLines.length} liens)`);
console.error(`Rapport: ${reportPath}`);
console.log(outputLines.join("\n"));
