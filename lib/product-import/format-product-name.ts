const BRAND_RE =
  /\b(zalando|nike|adidas|puma|reebok|under\s*armour|new\s*balance|jordan|foot\s*locker|decathlon|go\s*sport|intersport|amazon|asos|hm|h&m|uniqlo|kappa|umbro|lotto|hummel|joma|macron|errea|castore|fanatics|soccer\.com|pro\s*direct|sports\s*direct)\b/gi;

const NOISE_RE =
  /\b(performance|replica|réplique|replique|authentic|authentique|official|officiel|world\s*cup|coupe\s*du\s*monde|euro\s*\d*|champions\s*league|ligue\s*des\s*champions|jersey|football|soccer|shirt|kit\s*home|kit\s*away|training|match|stadium|edition|édition|limited|limitée|player|joueur|messi|ronaldo|mbappé|mbappe|neymar|haaland|dfb|cff|fff|rfef|figc|original|premium|pro|fan|supporter|unisex|homme|femme|enfant|junior|senior|men|women|kids|boys|girls|garçon|fille|adulte|size|taille)\b/gi;

const SITE_RE =
  /\b(www\.[a-z0-9.-]+|zalando|\.fr\b|\.com\b|\.net\b|\.de\b|\.es\b|\.it\b|shop|store|boutique)\b/gi;

const COLOR_RE =
  /\b(rouge|bleu|vert|jaune|orange|violet|rose|noir|blanc|gris|marron|beige|bordeaux|marine|turquoise|corail|multicolou?re|multicolor|red|blue|green|yellow|purple|pink|black|white|grey|gray|navy|gold|silver|cream|burgundy)\b/gi;

const SIZE_RE = /\b(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|\d{2,3})\b/g;

const KIT_HOME =
  /\b(domicile|home|principal|1er|premier|first|heimm|heimtrikot|intérieur|interieur)\b/i;
const KIT_AWAY =
  /\b(extérieur|exterieur|away|second|deuxième|deuxieme|2e|2ème|auswärts|auswart)\b/i;
const KIT_THIRD =
  /\b(third|troisième|troisieme|3e|3ème|alternatif|alternate|special)\b/i;

const SHORT_RE = /\b(short|shorts|pantalon|pant)\b/i;

const KIDS_RE = /\benfant\b/i;

export type ProductAudience = "adult" | "kids";

/** Détecte « enfant » dans le titre source (avant nettoyage). */
export function detectAudience(text: string): ProductAudience {
  return KIDS_RE.test(text) ? "kids" : "adult";
}

export function detectProductCollectionKind(
  text: string,
): import("@/lib/product-collection").ProductCollectionKind {
  return SHORT_RE.test(text) ? "short" : "jersey";
}

/** Alias anglais / abréviations → nom français affiché. */
const TEAM_ALIASES: Readonly<Record<string, string>> = {
  belgium: "Belgique",
  netherlands: "Pays-Bas",
  holland: "Pays-Bas",
  mexico: "Mexique",
  argentina: "Argentine",
  germany: "Allemagne",
  dfb: "Allemagne",
  france: "France",
  spain: "Espagne",
  portugal: "Portugal",
  brazil: "Brésil",
  brasil: "Brésil",
  england: "Angleterre",
  italy: "Italie",
  morocco: "Maroc",
  usa: "USA",
  japan: "Japon",
  croatia: "Croatie",
  senegal: "Sénégal",
  algeria: "Algérie",
  tunisia: "Tunisie",
  egypt: "Égypte",
  poland: "Pologne",
  switzerland: "Suisse",
  austria: "Autriche",
  turkey: "Turquie",
  scotland: "Écosse",
  wales: "Pays de Galles",
  ireland: "Irlande",
};

const KNOWN_TEAMS: readonly string[] = [
  "Maroc",
  "France",
  "Espagne",
  "Portugal",
  "Allemagne",
  "Brésil",
  "Argentine",
  "Belgique",
  "Angleterre",
  "Italie",
  "Pays-Bas",
  "Croatie",
  "Sénégal",
  "Algérie",
  "Tunisie",
  "Égypte",
  "Côte d'Ivoire",
  "Cameroun",
  "Nigeria",
  "Ghana",
  "Mali",
  "USA",
  "Mexique",
  "Japon",
  "Corée du Sud",
  "Uruguay",
  "Colombie",
  "Chili",
  "Pérou",
  "Équateur",
  "Danemark",
  "Suède",
  "Norvège",
  "Suisse",
  "Autriche",
  "Pologne",
  "Turquie",
  "Grèce",
  "Serbie",
  "Ukraine",
  "Russie",
  "Écosse",
  "Pays de Galles",
  "Irlande",
  "Paris Saint-Germain",
  "PSG",
  "Real Madrid",
  "Barcelona",
  "Barcelone",
  "Manchester United",
  "Manchester City",
  "Liverpool",
  "Chelsea",
  "Arsenal",
  "Tottenham",
  "Bayern Munich",
  "Bayern",
  "Borussia Dortmund",
  "Inter Milan",
  "AC Milan",
  "Milan",
  "Juventus",
  "Napoli",
  "Roma",
  "Lazio",
  "Atlético Madrid",
  "Atletico Madrid",
  "Monaco",
  "Marseille",
  "Lyon",
  "Lille",
  "Nice",
  "Lens",
  "Rennes",
];

function detectTeam(source: string): string | null {
  const lower = source.toLowerCase();

  for (const [alias, label] of Object.entries(TEAM_ALIASES)) {
    const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(lower)) return label;
  }

  for (const team of KNOWN_TEAMS) {
    const re = new RegExp(`\\b${team.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(source)) return team === "PSG" ? "PSG" : team;
  }

  return null;
}

function detectYear(text: string): string | null {
  const full = text.match(/\b(20[2-3]\d)\b/);
  if (full?.[1]) return full[1];

  const season = text.match(/\b(\d{2})\s*[/\\-]\s*(\d{2})\b/);
  if (season) {
    const second = Number.parseInt(season[2]!, 10);
    return second < 50 ? `20${season[2]}` : `19${season[2]}`;
  }

  return null;
}

function detectKitType(text: string): string {
  if (KIT_THIRD.test(text)) return "Third";
  if (KIT_AWAY.test(text)) return "Extérieur";
  if (KIT_HOME.test(text)) return "Domicile";
  return "Domicile";
}

function detectProductType(text: string): "Maillot" | "Short" {
  return SHORT_RE.test(text) ? "Short" : "Maillot";
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(BRAND_RE, " ")
    .replace(NOISE_RE, " ")
    .replace(SITE_RE, " ")
    .replace(COLOR_RE, " ")
    .replace(SIZE_RE, " ")
    .replace(/[|•·]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Formate un titre : « Maillot Maroc Domicile 2025 »
 * Uniquement type + équipe/pays + domicile/extérieur + année.
 */
export function formatProductName(rawTitle: string, extraText = ""): string {
  const source = `${rawTitle} ${extraText}`.trim();
  if (!source) return "Maillot";

  const audience = detectAudience(source);
  const productType = detectProductType(source);
  const kitType = detectKitType(source);
  const year =
    detectYear(source) ?? detectYear(cleanTitle(source)) ?? String(new Date().getFullYear());
  const team = detectTeam(source) ?? detectTeam(cleanTitle(source)) ?? "Équipe";

  const audienceTag = audience === "kids" ? "Enfant " : "";
  return `${productType} ${audienceTag}${team} ${kitType} ${year}`
    .replace(/\s+/g, " ")
    .trim();
}
