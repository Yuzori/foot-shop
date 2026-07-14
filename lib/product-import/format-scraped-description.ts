/** Nettoie et structure une description scrappée (sans bruit UI / métadonnées). */

const NOISE_LINE_PATTERNS: RegExp[] = [
  /^loading$/i,
  /^chargement$/i,
  /^chargement\s*en\s*cours/i,
  /^upc\b/i,
  /^ean\b/i,
  /^code\s*upc/i,
  /^code\s*ean/i,
  /^référence\s*(produit|article)?/i,
  /^ref(?:erence)?\s*[:#]/i,
  /^additional\s+information/i,
  /^informations?\s+complémentaires?/i,
  /^informations?\s+additionnelles?/i,
  /^plus\s+d'?informations?/i,
  /^voir\s+(plus|moins)$/i,
  /^afficher\s+(plus|moins)$/i,
  /^[\+\−\-–—•·\s]+$/,
  /^[+\-]\s*$/i,
  /^(show|hide)\s+(more|less)$/i,
  /^description$/i,
  /^détails$/i,
  /^caractéristiques$/i,
  /^sku\b/i,
  /^mpn\b/i,
  /^gtin\b/i,
  /^article\s*#?\d*$/i,
];

const INLINE_NOISE_PATTERNS: RegExp[] = [
  /\bupc\s*code\s*:?\s*[\d\s-]+/gi,
  /\bean\s*:?\s*[\d\s-]+/gi,
  /\bgtin\s*:?\s*[\d\s-]+/gi,
  /\bsku\s*:?\s*[\w-]+/gi,
  /\bloading\b/gi,
  /\bchargement\b/gi,
  /\badditional\s+information\b/gi,
  /\binformations?\s+complémentaires?\b/gi,
];

function isNoiseLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (t.length <= 2) return true;
  return NOISE_LINE_PATTERNS.some((re) => re.test(t));
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ0-9«"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12 && !isNoiseLine(s));
}

/** Formate une description brute en texte lisible pour PrestaShop / fiche produit. */
export function formatScrapedDescription(raw: string): string {
  let text = raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  for (const pattern of INLINE_NOISE_PATTERNS) {
    text = text.replace(pattern, " ");
  }

  text = text
    .replace(/[\+\−]\s*Description/gi, "Description")
    .replace(/\s*[\+\−]\s*/g, "\n")
    .replace(/[•·]{2,}/g, "\n")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => !isNoiseLine(line));

  if (!lines.length) return "";

  const merged = lines.join(" ").replace(/\s+/g, " ").trim();
  const sentences = splitSentences(merged);
  if (sentences.length >= 2) {
    return sentences.join("\n\n").slice(0, 4000);
  }

  if (lines.length >= 2) {
    return lines.join("\n\n").slice(0, 4000);
  }

  return merged.slice(0, 4000);
}
