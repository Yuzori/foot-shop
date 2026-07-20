import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalog = {
  ...JSON.parse(
    readFileSync(join(__dirname, "unisport-sitemap-catalog.json"), "utf8")
  ),
  // URLs confirmées (sondage / pages produit) absentes ou mal indexées dans le sitemap
  "espagne-maillot-exterieur-coupe-du-monde-2026":
    "https://www.unisportstore.fr/maillots-de-football/espagne-maillot-exterieur-coupe-du-monde-2026/430386/",
  "argentine-maillot-domicile-202526-messi-10":
    "https://www.unisportstore.fr/maillots-de-football/argentine-maillot-domicile-202526-messi-10/431637/",
  "argentine-maillot-exterieur-coupe-du-monde-2026":
    "https://www.unisportstore.fr/maillots-de-football/argentine-maillot-exterieur-coupe-du-monde-2026/430358/",
  "france-maillot-exterieur-coupe-du-monde-2026":
    "https://www.unisportstore.fr/maillots-de-football/france-maillot-exterieur-coupe-du-monde-2026/462372/",
  "bresil-maillot-exterieur-coupe-du-monde-2026":
    "https://www.unisportstore.fr/maillots-de-football/bresil-maillot-exterieur-coupe-du-monde-2026/438151/",
  "belgique-maillot-exterieur-coupe-du-monde-2026":
    "https://www.unisportstore.fr/maillots-de-football/belgique-maillot-exterieur-coupe-du-monde-2026/430354/",
  "japon-maillot-exterieur-coupe-du-monde-2026":
    "https://www.unisportstore.fr/maillots-de-football/japon-maillot-exterieur-coupe-du-monde-2026/430363/",
  "mexique-maillot-domicile-coupe-du-monde-2026":
    "https://www.unisportstore.fr/maillots-de-football/mexique-maillot-domicile-coupe-du-monde-2026/430317/",
  "norvege-3eme-maillot-coupe-du-monde-2026":
    "https://www.unisportstore.fr/maillots-de-football/norvege-3eme-maillot-coupe-du-monde-2026/461749/",
  "canada-maillot-exterieur-coupe-du-monde-2026":
    "https://www.unisportstore.fr/maillots-de-football/canada-maillot-exterieur-coupe-du-monde-2026/463008/",
};
const inputRaw = readFileSync(join(__dirname, "unisport-input-urls.txt"), "utf8");

const UNISPORT_HOST = "unisportstore.fr";

const TEAM_SLUG = {
  espagne: "espagne",
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
  colombie: "colombie",
  colombia: "colombie",
  nigeria: "nigeria",
  maroc: "maroc",
  morocco: "maroc",
  algerie: "algerie",
  algeria: "algerie",
  pologne: "pologne",
  poland: "pologne",
  chili: "chili",
  chile: "chili",
  turquie: "turquie",
  turkey: "turquie",
  ghana: "ghana",
  curacao: "curacao",
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
  arabiesaoudite: "arabie-saoudite",
  saudi: "arabie-saoudite",
};

const CODE_MAP = {
  esp: "espagne",
  fff: "france",
  fra: "france",
  jap: "japon",
  cro: "croatie",
  clb: "colombie",
  nor: "norvege",
  pol: "pologne",
  chl: "chili",
  usa: "usa",
  rdc: "rd-congo",
};

function stripAccents(s) {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function parseUrls(raw) {
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

function cleanUnisport(url) {
  try {
    const u = new URL(url.split("#")[0]);
    if (!u.hostname.includes(UNISPORT_HOST)) return null;
    const path = u.pathname.replace(/\/$/, "");
    const m = path.match(/^(.*\/(?:maillots-de-football|t-shirts)\/[^/]+\/\d+)/i);
    return m ? `https://www.unisportstore.fr${m[1]}/` : null;
  } catch {
    return null;
  }
}

function detectKit(text) {
  const t = text.toLowerCase();
  if (/\b(third|troisieme|troisième|3e|3ème|thd|alternatif|3eme)\b/.test(t))
    return "third";
  if (/\b(away|exterieur|extérieur|exterior|ext|auswarts)\b/.test(t))
    return "exterieur";
  if (/\b(gardien|goalkeeper|gk|gkd)\b/.test(t)) return "gardien";
  if (/\b(home|domicile|dom|principal|interieur|intérieur)\b/.test(t))
    return "domicile";
  return "domicile";
}

function detectTeam(hay) {
  const norm = stripAccents(hay.toLowerCase());
  const tokens = norm.split(/[^a-z0-9]+/).filter(Boolean);

  for (const token of tokens) {
    const key = token.replace(/[^a-z0-9]/g, "");
    if (TEAM_SLUG[key]) return TEAM_SLUG[key];
  }

  const joined = tokens.join("");
  for (const [key, slug] of Object.entries(TEAM_SLUG)) {
    if (joined.includes(key)) return slug;
  }

  const code = hay.match(/\b([a-z]{2,3})26\b/i);
  if (code && CODE_MAP[code[1].toLowerCase()])
    return CODE_MAP[code[1].toLowerCase()];

  if (/republique.?democratique|rdc|rd-congo|rd congo/i.test(hay))
    return "rd-congo";

  return null;
}

function extractRef(url) {
  const u = new URL(url);
  const path = decodeURIComponent(u.pathname + u.search);
  const team = detectTeam(path);
  let kit = detectKit(path);
  const authentic = /authentic|authentique|aero-fit|vapor|player edition/i.test(
    path
  );
  const messi = /messi/i.test(path);
  const wc = /world[\s-]?cup|coupe[\s-]?du[\s-]?monde|cdm|wc\s*20/i.test(path);
  const kids = /enfant|junior|kids|youth|garcon|bebe|bébé|mini-kit/i.test(path);
  const prematch = /pre-match|prematch|jacquemus|avant-match|training/i.test(
    path
  );
  const special = /eusebio|edition.?speciale|special/i.test(path);

  // Zalando SKU hints
  if (path.includes("argentina-afa-home") || path.includes("AD542D662"))
    return { team: "argentine", kit: "domicile", messi: true, authentic, wc, kids, prematch, special };
  if (path.includes("AD542D6SB") || path.includes("black-lucid-blue"))
    return { team: "argentine", kit: "exterieur", messi: false, authentic, wc, kids, prematch, special };
  if (path.includes("belgium-26-away") || path.includes("AD542D6CE"))
    return { team: "belgique", kit: "exterieur", messi, authentic, wc, kids, prematch, special };
  if (path.includes("italy-26-home") || path.includes("AD542D660"))
    return { team: "italie", kit: "domicile", messi, authentic, wc, kids, prematch, special };
  if (path.includes("AD542D6JG") || path.includes("bold-green"))
    return { team: "mexique", kit: "domicile", messi, authentic, wc, kids, prematch, special };
  if (path.includes("usa-202627") || path.includes("N1242D7O8"))
    return { team: "usa", kit: "domicile", messi, authentic, wc, kids, prematch, special };
  if (path.includes("sweden-home") || path.includes("AD542D679"))
    return { team: "suede", kit: "domicile", messi, authentic, wc, kids, prematch, special };
  if (path.includes("N1242D864") || path.includes("rotschwarz"))
    return { team: "allemagne", kit: "exterieur", messi, authentic, wc, kids, prematch, special };
  if (path.includes("AD542D6R2") || path.includes("team-dark-green"))
    return { team: "arabie-saoudite", kit: "domicile", messi, authentic, wc, kids, prematch, special };
  if (path.includes("AD542D6R5") || path.includes("cloud-white"))
    return { team: "pologne", kit: "domicile", messi, authentic, wc, kids, prematch, special };
  if (path.includes("colombia-26-away") || path.includes("AD542D6CS"))
    return { team: "colombie", kit: "exterieur", messi, authentic, wc, kids, prematch, special };
  if (path.includes("turkey") && path.includes("N1242D825"))
    return { team: "turquie", kit: "domicile", messi, authentic, wc, kids, prematch, special };
  if (path.includes("turkey") && path.includes("N1242D81M"))
    return { team: "turquie", kit: "exterieur", messi, authentic, wc, kids, prematch, special };

  // SKU from foot-store / intersport
  if (path.includes("if7054") || path.includes("IO2231"))
    return { team: "bresil", kit: "domicile", messi, authentic, wc: true, kids, prematch, special };
  if (path.includes("ib5205") || path.includes("IB5205"))
    return { team: "nigeria", kit: "exterieur", messi, authentic: true, wc: true, kids, prematch, special };
  if (path.includes("783318") || path.includes("783318-02"))
    return { team: "maroc", kit: "exterieur", messi, authentic, wc: true, kids, prematch, special };
  if (path.includes("783288"))
    return { team: "portugal", kit: "exterieur", messi, authentic, wc, kids, prematch, special };
  if (path.includes("783278") || path.includes("783419"))
    return { team: team === "ghana" ? "ghana" : "portugal", kit: "domicile", messi, authentic, wc, kids, prematch, special };
  if (path.includes("jn2074"))
    return { team: "japon", kit: "exterieur", messi, authentic, wc, kids, prematch, special };
  if (path.includes("IB5386"))
    return { team: "coree-du-sud", kit: "exterieur", messi, authentic, wc, kids, prematch, special };
  if (path.includes("KA4044"))
    return { team: "costa-rica", kit: "exterieur", messi, authentic, wc, kids, prematch, special };
  if (path.includes("IO8507"))
    return { team: "pologne", kit: "exterieur", messi, authentic, wc, kids, prematch, special };
  if (path.includes("LE3402"))
    return { team: "curacao", kit: "domicile", messi, authentic, wc, kids: true, prematch, special };
  if (path.includes("KC6053"))
    return { team: "algerie", kit: "exterieur", messi, authentic: true, wc, kids, prematch, special };

  if (/footyheadlines/i.test(path) && /usa|etats/i.test(path))
    kit = "gardien";

  return { team, kit, messi, authentic, wc, kids, prematch, special };
}

function scoreSlug(slug, ref) {
  if (!ref.team) return -999;
  const s = slug.toLowerCase();
  if (!s.includes(ref.team.replace("coree-du-sud", "coree"))) return -100;

  // Portugal PUMA uses fpf- prefix
  if (ref.team === "portugal" && !s.includes("portugal") && !s.includes("fpf"))
    return -100;

  let score = 0;
  if (s.includes(ref.team)) score += 50;

  if (ref.kit === "domicile" && /domicile|home/.test(s)) score += 30;
  if (ref.kit === "exterieur" && /exterieur|away/.test(s)) score += 30;
  if (ref.kit === "third" && /(third|3eme|troisieme)/.test(s)) score += 30;
  if (ref.kit === "gardien" && /gardien|goalkeeper/.test(s)) score += 30;

  if (ref.wc && /coupe-du-monde|world-cup|2026|202627|202526/.test(s))
    score += 15;
  if (ref.authentic && /authentic|aero-fit|vapor/.test(s)) score += 12;
  if (!ref.authentic && /authentic|aero-fit|vapor|player-edition/.test(s))
    score -= 8;
  if (ref.messi && /messi/.test(s)) score += 20;
  if (!ref.messi && /messi|mbappe|ronaldo|haaland|olise/.test(s)) score -= 15;
  if (ref.kids && /enfant|jr|mini-kit|bebe|baby/.test(s)) score += 10;
  if (!ref.kids && /enfant|jr|mini-kit|bebe|baby/.test(s)) score -= 20;
  if (/manches-longues|ls-/.test(s)) score -= 5;
  if (/short|chaussettes|bob|casquette|t-shirt-dentrainement|training|warm-up/.test(s))
    score -= 40;
  if (ref.prematch && /t-shirt|training|warm-up|dentrainement/.test(s))
    score += 20;
  if (!ref.prematch && /t-shirt|training|warm-up|dentrainement/.test(s))
    score -= 25;
  if (ref.special && /eusebio|edition|special|125-ans|reissue|1994|2006/.test(s))
    score += 5;
  if (ref.special && !/eusebio|edition|special/.test(s)) score -= 5;

  if (ref.kit === "domicile" && /exterieur|away/.test(s)) score -= 25;
  if (ref.kit === "exterieur" && /domicile|home/.test(s)) score -= 25;

  // prefer maillots-de-football over t-shirts when tie
  if (s.startsWith("fpf-") && ref.team === "portugal") score += 5;

  return score;
}

function teamNeedles(team) {
  if (!team) return [];
  const needles = [team];
  if (team === "portugal") needles.push("fpf");
  if (team === "maroc") needles.push("frmf", "maroc");
  if (team === "ghana") needles.push("gfa", "ghana");
  if (team === "coree-du-sud") needles.push("coree");
  return needles;
}

function findBest(ref) {
  if (!ref.team) return null;
  const needles = teamNeedles(ref.team);
  let best = null;
  let bestScore = -1;
  for (const [slug, url] of Object.entries(catalog)) {
    const s = slug.toLowerCase();
    if (!needles.some((n) => s.includes(n))) continue;
    const score = scoreSlug(slug, ref);
    if (score > bestScore) {
      bestScore = score;
      best = { slug, url, score };
    }
  }
  return bestScore >= 45 ? best : null;
}

const urls = parseUrls(inputRaw);
const results = [];
const finalUrls = [];
const seen = new Set();

for (const url of urls) {
  if (url.includes(UNISPORT_HOST)) {
    const clean = cleanUnisport(url);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      finalUrls.push(clean);
      results.push({ source: url, unisport: clean, note: "déjà Unisport" });
    }
    continue;
  }

  const ref = extractRef(url);
  const best = findBest(ref);
  results.push({
    source: url,
    ref,
    unisport: best?.url ?? null,
    slug: best?.slug ?? null,
    score: best?.score ?? 0,
  });
  if (best?.url && !seen.has(best.url)) {
    seen.add(best.url);
    finalUrls.push(best.url);
  }
}

const linksPath = join(__dirname, "unisport-resolved-links.txt");
const reportPath = join(__dirname, "unisport-resolved-report.txt");

writeFileSync(linksPath, finalUrls.join("\n") + "\n", "utf8");

let report = `# Résolution Unisport — ${new Date().toISOString()}\n\n`;
report += `## Liens finaux (${finalUrls.length})\n\n`;
for (const u of finalUrls) report += `${u}\n`;

report += `\n## Détail par source (${results.length})\n`;
for (const r of results) {
  report += `\n### ${r.source}\n`;
  if (r.ref)
    report += `Réf: ${r.ref.team ?? "?"} | ${r.ref.kit} | wc=${r.ref.wc} | auth=${r.ref.authentic} | messi=${r.ref.messi}\n`;
  if (r.note) report += `${r.note}\n`;
  report += r.unisport ? `✓ ${r.unisport}\n` : `✗ NON TROUVÉ sur Unisport\n`;
}

writeFileSync(reportPath, report, "utf8");
console.log(`Liens: ${finalUrls.length} | Non trouvés: ${results.filter((r) => !r.unisport).length}`);
console.log(finalUrls.join("\n"));
