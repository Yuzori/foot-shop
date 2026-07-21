import { detectKitTypeFromName, kitTypeToFrenchLabel } from "@/lib/kit-type";

const BRAND_RE =
  /\b(zalando|nike|adidas|puma|reebok|under\s*armour|new\s*balance|jordan|foot\s*locker|decathlon|go\s*sport|intersport|amazon|asos|hm|h&m|uniqlo|kappa|umbro|lotto|hummel|joma|macron|errea|castore|fanatics|soccer\.com|pro\s*direct|sports\s*direct)\b/gi;

const NOISE_RE =
  /\b(performance|replica|réplique|replique|authentic|authentique|official|officiel|world\s*cup|coupe\s*du\s*monde|euro\s*\d*|champions\s*league|ligue\s*des\s*champions|jersey|football|soccer|shirt|kit\s*home|kit\s*away|training|match|stadium|edition|édition|limited|limitée|player|joueur|messi|ronaldo|mbappé|mbappe|neymar|haaland|dfb|cff|fff|rfef|figc|original|premium|pro|fan|supporter|unisex|homme|femme|enfant|junior|senior|men|women|kids|boys|girls|garçon|fille|adulte|size|taille)\b/gi;

const SITE_RE =
  /\b(www\.[a-z0-9.-]+|zalando|\.fr\b|\.com\b|\.net\b|\.de\b|\.es\b|\.it\b|shop|store|boutique)\b/gi;

const COLOR_RE =
  /\b(rouge|bleu|vert|jaune|orange|violet|rose|noir|blanc|gris|marron|beige|bordeaux|marine|turquoise|corail|multicolou?re|multicolor|red|blue|green|yellow|purple|pink|black|white|grey|gray|navy|gold|silver|cream|burgundy)\b/gi;

const SIZE_RE = /\b(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|\d{2,3})\b/g;

const SHORT_RE = /\b(short|shorts|pantalon|pant)\b/i;

/** Titre produit : maillot enfant, junior, kids, ensemble, etc. */
const KIDS_TITLE_RE =
  /\b(maillot|kit|short|shirt|jersey)\s+[-–]?\s*enfant\b|\benfant\s+[-–]?\s*(maillot|kit|short|shirt|jersey)\b|\b(junior|kids?|youth|garçon|garcon|fille|boys?|girls?)\b|\b(ensemble|kids?\s*kit|mini[\s-]?kit|kids?\s*set|baby\s*kit)\b/i;

/** Description : formulations explicites (pas une simple mention « enfant » ailleurs sur la page). */
const KIDS_DESC_RE =
  /\b(maillot|kit|short)\s+(pour\s+)?enfants?\b|\bversion\s+enfant\b|\btaille\s+enfant\b|\b\d+\s*[-–]\s*\d+\s*ans\b|\b(enfant|junior|kids?|youth)\s*:\s*\d/i;

/** Nom déjà formaté par formatProductName (« Maillot Enfant … »). */
const FORMATTED_KIDS_RE = /^(maillot|short)\s+enfant\b/i;

export type ProductAudience = "adult" | "kids";

/**
 * Détecte un maillot enfant uniquement si le titre ou la description du produit
 * l’indique explicitement (évite les faux positifs depuis le texte de la page).
 */
export function detectAudienceFromProduct(
  title: string,
  description = "",
): ProductAudience {
  const t = title.trim();
  if (!t) return "adult";

  if (KIDS_TITLE_RE.test(t)) return "kids";
  if (/\benfant\b/i.test(t) && /\b(maillot|kit|short|jersey|shirt)\b/i.test(t)) {
    return "kids";
  }

  const d = description.slice(0, 2500);
  if (d && KIDS_DESC_RE.test(d)) return "kids";
  if (
    d &&
    /\benfant\b/i.test(d) &&
    /\b(ce\s+(maillot|kit|short)|cet\s+article|produit|article)\b/i.test(d) &&
    /\b(maillot|kit|short)\b/i.test(d)
  ) {
    return "kids";
  }

  return "adult";
}

/** Détecte l’audience sur un nom déjà formaté ou un texte brut. */
export function detectAudience(text: string): ProductAudience {
  if (FORMATTED_KIDS_RE.test(text.trim())) return "kids";
  const lines = text.split(/\n/);
  const title = lines[0]?.trim() ?? text.trim();
  const rest = lines.slice(1).join(" ").trim();
  return detectAudienceFromProduct(title, rest);
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
  curacao: "Curaçao",
  "curaçao": "Curaçao",
  switzerland: "Suisse",
  austria: "Autriche",
  turkey: "Turquie",
  scotland: "Écosse",
  wales: "Pays de Galles",
  sweden: "Suède",
  sverige: "Suède",
  norway: "Norvège",
  norge: "Norvège",
  denmark: "Danemark",
  danmark: "Danemark",
  finland: "Finlande",
  suomi: "Finlande",
  iceland: "Islande",
  hungary: "Hongrie",
  romania: "Roumanie",
  czech: "République tchèque",
  slovakia: "Slovaquie",
  slovenia: "Slovénie",
  canada: "Canada",
  australia: "Australie",
  korea: "Corée du Sud",
  "south korea": "Corée du Sud",
  ecuador: "Équateur",
  chile: "Chili",
  peru: "Pérou",
  paraguay: "Paraguay",
  uruguay: "Uruguay",
  colombia: "Colombie",
  nigeria: "Nigeria",
  ghana: "Ghana",
  cameroon: "Cameroun",
  qatar: "Qatar",
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

export type ParsedSeason =
  | { kind: "range"; start: number; end: number; raw: string }
  | { kind: "single"; year: number; raw: string };

/** Extrait une saison football depuis un texte (2025-2026, 25-26, 2026…). */
export function parseSeasonFromText(text: string): ParsedSeason | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fullRange = trimmed.match(/(?:^|[^\d])(20\d{2})\s*[-_/]\s*(20\d{2})(?:[^\d]|$)/);
  if (fullRange?.[1] && fullRange[2]) {
    const start = Number.parseInt(fullRange[1], 10);
    const end = Number.parseInt(fullRange[2], 10);
    if (end > start && end - start <= 2) {
      return { kind: "range", start, end, raw: `${fullRange[1]}-${fullRange[2]}` };
    }
  }

  const compactRange = trimmed.match(/(?:^|[^\d])(\d{2})\s*[-_/]\s*(\d{2})(?:[^\d]|$)/);
  if (compactRange?.[1] && compactRange[2]) {
    const y1 = Number.parseInt(compactRange[1], 10);
    const y2 = Number.parseInt(compactRange[2], 10);
    const start = y1 < 50 ? 2000 + y1 : 1900 + y1;
    const end = y2 < 50 ? 2000 + y2 : 1900 + y2;
    if (end === start + 1) {
      return { kind: "range", start, end, raw: `${compactRange[1]}-${compactRange[2]}` };
    }
  }

  const single = trimmed.match(/(?:^|[^\d])(20[2-3]\d)(?:[^\d]|$)/);
  if (single?.[1]) {
    return {
      kind: "single",
      year: Number.parseInt(single[1], 10),
      raw: single[1],
    };
  }

  return null;
}

/** Saison compacte affichée : 25-26 pour une plage, 2026 pour une année seule. */
export function seasonToCompact(season: ParsedSeason): string {
  if (season.kind === "range") {
    return `${String(season.start).slice(-2)}-${String(season.end).slice(-2)}`;
  }
  return String(season.year);
}

function detectSeasonCompact(text: string): string | null {
  const parsed = parseSeasonFromText(text);
  return parsed ? seasonToCompact(parsed) : null;
}

/**
 * Normalise le nom d'un maillot déjà en boutique : saison en format 25-26.
 * Retourne null si pas un maillot, pas de saison détectée, ou déjà correct.
 */
export function normalizeJerseyProductName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed || !/\bmaillot\b/i.test(trimmed) || SHORT_RE.test(trimmed)) {
    return null;
  }

  const parsed = parseSeasonFromText(trimmed);
  if (!parsed) return null;

  const compact = seasonToCompact(parsed);
  const trailingCompact = trimmed.match(/\b(\d{2}-\d{2})\s*$/);
  if (trailingCompact?.[1] === compact) return null;

  const base = trimmed
    .replace(/\b20\d{2}\s*[-/]\s*20\d{2}\b/g, " ")
    .replace(/\b\d{2}\s*[-/]\s*\d{2}\b/g, " ")
    .replace(/\b20[2-3]\d\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!base) return null;

  const normalized = `${base} ${compact}`.replace(/\s+/g, " ").trim();
  return normalized === trimmed ? null : normalized;
}

/** Nom affiché côté boutique (normalisation saison sans écrire en base). */
export function displayJerseyProductName(name: string): string {
  return normalizeJerseyProductName(name) ?? name;
}

function detectKitType(text: string): string {
  return kitTypeToFrenchLabel(detectKitTypeFromName(text) ?? "domicile");
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

function detectTeamFromUrl(sourceUrl: string): string | null {
  return extractTeamFromSlugTokens(sourceUrl);
}

/** Analyse chaque segment d'URL (slug) pour retrouver le pays / club. */
export function extractTeamFromSlugTokens(sourceUrl: string): string | null {
  try {
    const url = new URL(sourceUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    const tokens: string[] = [];

    for (const seg of segments) {
      const decoded = decodeURIComponent(seg).replace(/\.[a-z0-9]{2,5}$/i, "");
      tokens.push(
        ...decoded
          .split(/[-_+]+/)
          .map((t) => t.trim())
          .filter((t) => t.length >= 2),
      );
    }

    const hay = tokens.join(" ");
    const fromHay = detectTeam(hay);
    if (fromHay) return fromHay;

    const sortedTeams = [...KNOWN_TEAMS].sort((a, b) => b.length - a.length);
    for (const team of sortedTeams) {
      const re = new RegExp(
        `\\b${team.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "i",
      );
      if (re.test(hay)) return team === "PSG" ? "PSG" : team;
    }

    for (const token of tokens) {
      if (token.length < 3 || /^\d+$/.test(token)) continue;
      const found = detectTeam(token);
      if (found) return found;
    }

    return detectTeam(
      decodeURIComponent(url.pathname).replace(/[-_/]+/g, " "),
    );
  } catch {
    return null;
  }
}

/**
 * Formate un titre : « Maillot Maroc Domicile 25-26 »
 * Uniquement type + équipe/pays + domicile/extérieur + saison (format compact).
 * L'équipe est déduite du titre et de l'URL (pas du texte de page entier).
 */
export function formatProductName(rawTitle: string, sourceUrl = ""): string {
  const title = rawTitle.trim();
  if (!title && !sourceUrl) return "Maillot";

  const audience = detectAudienceFromProduct(title, "");
  const productType = detectProductType(`${title} ${sourceUrl}`);
  const kitType = detectKitType(title);
  const seasonCompact =
    detectSeasonCompact(title) ??
    detectSeasonCompact(sourceUrl) ??
    detectSeasonCompact(cleanTitle(title));
  const team =
    detectTeam(title) ??
    detectTeam(cleanTitle(title)) ??
    extractTeamFromSlugTokens(sourceUrl) ??
    detectTeamFromUrl(sourceUrl) ??
    "Équipe";

  const audienceTag = audience === "kids" ? "Enfant " : "";
  const parts = [`${productType} ${audienceTag}${team}`.trim(), kitType];
  if (seasonCompact) parts.push(seasonCompact);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
