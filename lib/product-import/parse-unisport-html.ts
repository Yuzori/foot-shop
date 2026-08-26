import { toHighQualityImageUrl } from "@/lib/product-import/image-url-quality";

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }
  return null;
}

/** ID produit numérique en fin d'URL Unisport (ex. …/377529/). */
export function extractUnisportProductId(rawUrl: string): string | null {
  try {
    const path = new URL(rawUrl).pathname;
    const match = path.match(/\/(\d{4,})\/?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Images galerie Unisport (CDN thumblr.uniid.it). */
export function extractUnisportGalleryImages(html: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  const patterns = [
    /https?:\/\/thumblr\.uniid\.it\/product\/\d+\/[a-f0-9]+\.jpg[^"'\s>]*/gi,
    /thumblr\.uniid\.it\/product\/\d+\/[a-f0-9]+\.jpg[^"'\s>]*/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      let raw = decodeHtmlEntities(match[0].trim());
      if (!raw.startsWith("http")) raw = `https://${raw}`;
      try {
        const parsed = new URL(raw);
        parsed.search = "";
        const clean = toHighQualityImageUrl(parsed.toString());
        const key = clean.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        urls.push(clean);
      } catch {
        // ignore invalid URL
      }
    }
  }

  return urls;
}

export function extractUnisportTitle(html: string): string | null {
  return (
    extractMeta(html, "og:title") ??
    extractMeta(html, "twitter:title") ??
    null
  );
}

export type ParsedUnisportHtml = {
  title: string;
  imageUrls: string[];
};

/** Extrait titre + images depuis le code source d'une page produit Unisport. */
export function parseUnisportHtml(html: string, sourceUrl: string): ParsedUnisportHtml {
  const title =
    extractUnisportTitle(html)?.trim() ||
    extractUnisportProductId(sourceUrl) ||
    "Produit Unisport";

  const imageUrls = extractUnisportGalleryImages(html);
  if (!imageUrls.length) {
    const og = extractMeta(html, "og:image");
    if (og) imageUrls.push(toHighQualityImageUrl(og));
  }

  return { title, imageUrls };
}

export function isUnisportBlockedError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /405|403|accès refusé|method not allowed/i.test(message);
}
