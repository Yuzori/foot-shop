const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"')\]},]+/gi;

const TRAILING_JUNK_RE = /[)\]}>"',.;:]+$/;
const LEADING_JUNK_RE = /^[\s"'[(•\-–—\d.)\]]+/;

/** Nettoie et valide une URL extraite du texte collé. */
function normalizeExtractedUrl(raw: string): string | null {
  let value = raw.trim();
  if (!value) return null;

  value = value.replace(LEADING_JUNK_RE, "").replace(TRAILING_JUNK_RE, "");

  if (!/^https?:\/\//i.test(value)) return null;

  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Extrait chaque URL http(s) d'un bloc de texte collé.
 * Gère retours à la ligne, virgules, numéros de liste, puces, espaces, etc.
 */
export function parseSourceUrls(raw: string): string[] {
  if (!raw.trim()) return [];

  const seen = new Set<string>();
  const urls: string[] = [];

  const matches = raw.match(URL_IN_TEXT_RE) ?? [];
  for (const match of matches) {
    const normalized = normalizeExtractedUrl(match);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
  }

  if (urls.length > 0) return urls;

  // Secours : découpage explicite ligne par ligne
  for (const line of raw.split(/\r?\n/)) {
    for (const part of line.split(/[\s,;|]+/)) {
      const normalized = normalizeExtractedUrl(part);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      urls.push(normalized);
    }
  }

  return urls;
}
