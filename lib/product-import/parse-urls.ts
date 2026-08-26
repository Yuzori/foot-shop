const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"')\]},]+/gi;

const BARE_DOMAIN_URL_RE =
  /(?:^|[\s,;|(\["'•\-–—\d.)])(?:https?:\/\/)?(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\/[^\s<>"')\]},]*)?/gi;

const TRAILING_JUNK_RE = /[)\]}>"',.;:\r\n]+$/;
const LEADING_JUNK_RE = /^[\s"'[(•\-–—\d.)\]]+/;

function stripInvisibleChars(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\r/g, "");
}

function looksLikeDomainUrl(value: string): boolean {
  return /^(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?::\d+)?(?:\/[^\s]*)?$/i.test(
    value,
  );
}

/** Nettoie et valide une URL extraite du texte collé. */
function normalizeExtractedUrl(raw: string): string | null {
  let value = stripInvisibleChars(raw).trim();
  if (!value) return null;

  value = value.replace(LEADING_JUNK_RE, "").replace(TRAILING_JUNK_RE, "").trim();

  if (!/^https?:\/\//i.test(value)) {
    if (looksLikeDomainUrl(value)) {
      value = `https://${value}`;
    } else {
      return null;
    }
  }

  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function pushUniqueUrl(urls: string[], seen: Set<string>, raw: string): void {
  const normalized = normalizeExtractedUrl(raw);
  if (!normalized || seen.has(normalized)) return;
  seen.add(normalized);
  urls.push(normalized);
}

/**
 * Extrait chaque URL http(s) d'un bloc de texte collé.
 * Gère retours à la ligne, virgules, numéros de liste, puces, espaces, etc.
 * Accepte aussi les URLs sans schéma (ex. www.unisportstore.fr/...).
 */
export function parseSourceUrls(raw: string): string[] {
  const cleaned = stripInvisibleChars(raw);
  if (!cleaned.trim()) return [];

  const seen = new Set<string>();
  const urls: string[] = [];

  const matches = cleaned.match(URL_IN_TEXT_RE) ?? [];
  for (const match of matches) {
    pushUniqueUrl(urls, seen, match);
  }

  if (urls.length > 0) return urls;

  const bareMatches = cleaned.match(BARE_DOMAIN_URL_RE) ?? [];
  for (const match of bareMatches) {
    pushUniqueUrl(urls, seen, match);
  }

  if (urls.length > 0) return urls;

  // Secours : découpage explicite ligne par ligne
  for (const line of cleaned.split(/\r?\n/)) {
    for (const part of line.split(/[\s,;|]+/)) {
      pushUniqueUrl(urls, seen, part);
    }
  }

  return urls;
}
